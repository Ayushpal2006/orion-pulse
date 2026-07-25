import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { organizations, stores, users, sales, user_store_access } from "../db/schema";
import { eq, and, like, or, sql } from "drizzle-orm";
import { ValidationError, NotFoundError, ConflictError } from "../utils/errors";
import bcrypt from "bcryptjs";

export class SuperAdminController {
  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgRows = await db.select({ id: organizations.id, status: organizations.status }).from(organizations);
      const storeRows = await db.select({ id: stores.id }).from(stores);
      const userRows = await db.select({ id: users.id }).from(users);

      const totalOrganizations = orgRows.length;
      const activeOrganizations = orgRows.filter((o) => (o.status || "").toLowerCase() === "active").length;
      const trialOrganizations = orgRows.filter((o) => (o.status || "").toLowerCase() === "trial").length;
      const suspendedOrganizations = orgRows.filter((o) => (o.status || "").toLowerCase() === "suspended").length;

      const totalStores = storeRows.length;
      const totalUsers = userRows.length;

      const [salesSum] = await db
        .select({ total: sql<string>`COALESCE(SUM(${sales.grand_total}), 0)` })
        .from(sales);

      res.status(200).json({
        success: true,
        data: {
          totalOrganizations,
          activeOrganizations,
          trialOrganizations,
          suspendedOrganizations,
          totalStores,
          totalUsers,
          totalSales: Number(salesSum?.total || 0),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  listOrganizations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q, status } = req.query as { q?: string; status?: string };

      const allOrgs = await db.select().from(organizations);
      const allUsers = await db.select().from(users);
      const allStores = await db.select().from(stores);

      let result = allOrgs.map((org) => {
        const orgUsers = allUsers.filter((u) => u.organization_id === org.id);
        const owner =
          orgUsers.find((u) => ["owner", "admin"].includes((u.role || "").toLowerCase())) ||
          orgUsers[0] ||
          null;

        const orgStores = allStores.filter((s) => s.organization_id === org.id);

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          phone: org.phone || owner?.phone || "",
          email: org.email || owner?.email || "",
          status: org.status || "active",
          billingPlan: org.billing_plan || "Basic",
          ownerName: owner ? owner.name : "N/A",
          ownerEmail: owner ? owner.email : "N/A",
          ownerPhone: owner ? owner.phone || "N/A" : "N/A",
          storesCount: orgStores.length,
          createdAt: org.created_at,
        };
      });

      // Status Filtering
      if (status && status !== "all") {
        const filterStatus = status.toLowerCase();
        result = result.filter((o) => (o.status || "").toLowerCase() === filterStatus);
      }

      // Search Filtering (by Business Name, Email, Phone)
      if (q && q.trim()) {
        const query = q.trim().toLowerCase();
        result = result.filter(
          (o) =>
            o.name.toLowerCase().includes(query) ||
            o.email.toLowerCase().includes(query) ||
            o.phone.toLowerCase().includes(query) ||
            o.ownerName.toLowerCase().includes(query) ||
            o.ownerEmail.toLowerCase().includes(query)
        );
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getOrganizationDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("Invalid organization ID");
      }

      const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
      if (!org) {
        throw new NotFoundError("Organization not found");
      }

      const orgUsers = await db.select().from(users).where(eq(users.organization_id, id));
      const owner =
        orgUsers.find((u) => ["owner", "admin"].includes((u.role || "").toLowerCase())) ||
        orgUsers[0] ||
        null;

      const orgStores = await db.select().from(stores).where(eq(stores.organization_id, id));

      res.status(200).json({
        success: true,
        data: {
          organization: org,
          owner: owner
            ? {
                id: owner.id,
                name: owner.name,
                email: owner.email,
                phone: owner.phone,
                role: owner.role,
                status: owner.status,
              }
            : null,
          stores: orgStores.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            status: s.status,
            createdAt: s.created_at,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { status } = req.body;

      if (isNaN(id)) {
        throw new ValidationError("Invalid organization ID");
      }
      if (!status || !["active", "trial", "suspended"].includes(String(status).toLowerCase())) {
        throw new ValidationError("Status must be ACTIVE, TRIAL, or SUSPENDED");
      }

      const targetStatus = String(status).toLowerCase();

      const [updated] = await db
        .update(organizations)
        .set({ status: targetStatus, updated_at: new Date() })
        .where(eq(organizations.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundError("Organization not found");
      }

      res.status(200).json({
        success: true,
        message: `Organization status updated to ${targetStatus.toUpperCase()}`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  resetOwnerPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { newPassword } = req.body;

      if (isNaN(id)) {
        throw new ValidationError("Invalid organization ID");
      }
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        throw new ValidationError("New password must be at least 6 characters");
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Reset password for owner(s) belonging to organization
      const updatedUsers = await db
        .update(users)
        .set({ password_hash: passwordHash, updated_at: new Date() })
        .where(eq(users.organization_id, id))
        .returning();

      if (updatedUsers.length === 0) {
        throw new NotFoundError("No owner user found for this organization");
      }

      res.status(200).json({
        success: true,
        message: `Password successfully reset for owner of organization #${id}`,
      });
    } catch (error) {
      next(error);
    }
  };

  createOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        businessName,
        gstNumber,
        address,
        phone,
        ownerName,
        email,
        password,
        storeName,
        storeAddress,
      } = req.body;

      if (!businessName || !businessName.trim()) {
        throw new ValidationError("Business Name is required");
      }
      if (!ownerName || !ownerName.trim()) {
        throw new ValidationError("Owner Name is required");
      }
      if (!email || !email.trim()) {
        throw new ValidationError("Owner Email is required");
      }
      if (!password || password.length < 6) {
        throw new ValidationError("Password must be at least 6 characters");
      }
      if (!phone || !phone.trim()) {
        throw new ValidationError("Phone Number is required");
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check existing email
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingUser) {
        throw new ConflictError("A user with this email address already exists");
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const slug = businessName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString().slice(-4);
      const sName = storeName && storeName.trim() ? storeName.trim() : `${businessName.trim()} Main Store`;
      const sAddr = storeAddress && storeAddress.trim() ? storeAddress.trim() : address ? address.trim() : null;

      const result = await db.transaction(async (tx) => {
        // 1. Create Organization (Mark status = TRIAL as required)
        const [org] = await tx
          .insert(organizations)
          .values({
            name: businessName.trim(),
            slug,
            phone: phone.trim(),
            email: normalizedEmail,
            gst_number: gstNumber ? gstNumber.trim() : null,
            address: address ? address.trim() : null,
            status: "trial",
            billing_plan: "Basic",
            subscription_status: "active",
            onboarding_completed: 0,
          })
          .returning();

        // 2. Create Main Store
        const [store] = await tx
          .insert(stores)
          .values({
            organization_id: org.id,
            name: sName,
            code: `STR-${Date.now().toString().slice(-4)}`,
            address: sAddr,
            phone: phone.trim(),
            is_default: 1,
            status: "active",
          })
          .returning();

        // 3. Create Owner User
        const [user] = await tx
          .insert(users)
          .values({
            organization_id: org.id,
            store_id: store.id,
            name: ownerName.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            password_hash: passwordHash,
            role: "owner",
            status: "active",
            is_active: 1,
          })
          .returning();

        // 4. Link User to Store Access
        await tx.insert(user_store_access).values({
          user_id: user.id,
          store_id: store.id,
        });

        return { organization: org, store, user };
      });

      res.status(201).json({
        success: true,
        message: "Customer organization created successfully in TRIAL status",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  editOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("Invalid organization ID");
      }

      const { businessName, gstNumber, address, phone, email } = req.body;

      const updateData: any = { updated_at: new Date() };
      if (businessName !== undefined) updateData.name = businessName.trim();
      if (gstNumber !== undefined) updateData.gst_number = gstNumber ? gstNumber.trim() : null;
      if (address !== undefined) updateData.address = address ? address.trim() : null;
      if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
      if (email !== undefined) updateData.email = email ? email.trim() : null;

      const [updated] = await db
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundError("Organization not found");
      }

      if (email || phone) {
        const ownerUpdate: any = { updated_at: new Date() };
        if (email) ownerUpdate.email = email.trim().toLowerCase();
        if (phone) ownerUpdate.phone = phone.trim();

        await db
          .update(users)
          .set(ownerUpdate)
          .where(and(eq(users.organization_id, id), eq(users.role, "owner")));
      }

      res.status(200).json({
        success: true,
        message: "Organization details updated successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };
}
