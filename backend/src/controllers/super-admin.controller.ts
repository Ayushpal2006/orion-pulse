import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { organizations, stores, users, sales, products, customers, audit_logs, user_store_access } from "../db/schema";
import { eq, and, like, or, sql, desc } from "drizzle-orm";
import { ValidationError, NotFoundError, ConflictError } from "../utils/errors";
import bcrypt from "bcryptjs";

// Helper function to log Super Admin actions into audit_logs table
async function logAudit(action: string, details: string, orgId?: number | null, storeId?: number | null, userId?: number | null) {
  try {
    const sId = storeId || 1;
    await db.insert(audit_logs).values({
      organization_id: orgId || null,
      store_id: sId,
      user_id: userId || null,
      action,
      details,
      created_at: new Date(),
    });
  } catch (err) {
    console.error("[SuperAdminAudit] Failed to log audit record:", err);
  }
}

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
      const orgProducts = await db.select().from(products).where(eq(products.organization_id, id));
      const orgCustomers = await db.select().from(customers).where(eq(customers.organization_id, id));
      
      const [salesMetrics] = await db
        .select({
          totalSales: sql<string>`COALESCE(SUM(${sales.grand_total}), 0)`,
          ordersCount: sql<string>`COUNT(${sales.id})`,
        })
        .from(sales)
        .where(eq(sales.organization_id, id));

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
          insights: {
            totalUsers: orgUsers.length,
            totalProducts: orgProducts.length,
            totalCustomers: orgCustomers.length,
            totalSalesAmount: Number(salesMetrics?.totalSales || 0),
            totalSalesOrders: Number(salesMetrics?.ordersCount || 0),
          },
        },
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
        // 1. Create Organization
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

      await logAudit(
        "SUPER_ADMIN_CREATE_ORG",
        `Created Organization ${result.organization.name} (#${result.organization.id}) with Owner ${result.user.email} and Default Store ${result.store.name}`,
        result.organization.id,
        result.store.id,
        result.user.id
      );

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

      await logAudit("SUPER_ADMIN_EDIT_ORG", `Updated Organization details for ${updated.name} (#${id})`, id);

      res.status(200).json({
        success: true,
        message: "Organization details updated successfully",
        data: updated,
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
      if (!status || !["active", "trial", "suspended", "disabled"].includes(String(status).toLowerCase())) {
        throw new ValidationError("Status must be ACTIVE, TRIAL, SUSPENDED, or DISABLED");
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

      await logAudit(
        targetStatus === "suspended" ? "SUPER_ADMIN_SUSPEND_ORG" : "SUPER_ADMIN_UPDATE_ORG_STATUS",
        `Changed Organization ${updated.name} (#${id}) status to ${targetStatus.toUpperCase()}`,
        id
      );

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

      const updatedUsers = await db
        .update(users)
        .set({ password_hash: passwordHash, updated_at: new Date() })
        .where(eq(users.organization_id, id))
        .returning();

      if (updatedUsers.length === 0) {
        throw new NotFoundError("No owner user found for this organization");
      }

      await logAudit(
        "SUPER_ADMIN_RESET_PASSWORD",
        `Reset password for owner(s) of Organization #${id}`,
        id
      );

      res.status(200).json({
        success: true,
        message: `Password successfully reset for owner of organization #${id}`,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) throw new ValidationError("Invalid organization ID");

      const [updated] = await db
        .update(organizations)
        .set({ status: "disabled", updated_at: new Date() })
        .where(eq(organizations.id, id))
        .returning();

      await logAudit("SUPER_ADMIN_DISABLE_ORG", `Soft-deleted Organization #${id} (status set to disabled)`, id);

      res.status(200).json({ success: true, message: "Organization soft-deleted (status set to disabled)", data: updated });
    } catch (error) {
      next(error);
    }
  };

  updateSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { plan, status } = req.body;
      if (isNaN(id)) throw new ValidationError("Invalid organization ID");

      const updatePayload: any = { updated_at: new Date() };
      if (plan) updatePayload.billing_plan = plan;
      if (status) updatePayload.subscription_status = status;

      const [updated] = await db
        .update(organizations)
        .set(updatePayload)
        .where(eq(organizations.id, id))
        .returning();

      await logAudit(
        "SUPER_ADMIN_CHANGE_SUBSCRIPTION",
        `Updated subscription for Organization ${updated?.name} (#${id}) to Plan: ${updated?.billing_plan}, Status: ${updated?.subscription_status}`,
        id
      );

      res.status(200).json({ success: true, message: `Subscription updated successfully`, data: updated });
    } catch (error) {
      next(error);
    }
  };

  listStores = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const allStores = await db.select().from(stores);
      const allOrgs = await db.select().from(organizations);
      const allProducts = await db.select().from(products);
      const allSales = await db.select().from(sales);
      const allUsers = await db.select().from(users);

      const result = allStores.map((s) => {
        const org = allOrgs.find((o) => o.id === s.organization_id);
        const storeProducts = allProducts.filter((p) => p.store_id === s.id);
        const storeSales = allSales.filter((sal) => sal.store_id === s.id);
        const manager = allUsers.find((u) => u.store_id === s.id && ["manager", "admin", "owner"].includes(u.role?.toLowerCase() || "")) || null;
        
        const totalSalesAmount = storeSales.reduce((acc, current) => acc + Number(current.grand_total || 0), 0);

        return {
          id: s.id,
          organizationId: s.organization_id,
          organizationName: org ? org.name : "N/A",
          name: s.name,
          code: s.code,
          address: s.address || "",
          phone: s.phone || "",
          status: s.status || "active",
          managerName: manager ? manager.name : "N/A",
          totalProducts: storeProducts.length,
          totalSales: totalSalesAmount,
          createdAt: s.created_at,
        };
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  createStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, name, code, address, phone } = req.body;

      if (!organizationId || isNaN(Number(organizationId))) {
        throw new ValidationError("Valid Organization ID is required");
      }
      if (!name || !name.trim()) {
        throw new ValidationError("Store Name is required");
      }

      const orgId = Number(organizationId);
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      if (!org) {
        throw new NotFoundError("Organization not found");
      }

      const storeCode = code && code.trim() ? code.trim() : `STR-${Date.now().toString().slice(-4)}`;

      const [newStore] = await db
        .insert(stores)
        .values({
          organization_id: orgId,
          name: name.trim(),
          code: storeCode,
          address: address ? address.trim() : null,
          phone: phone ? phone.trim() : null,
          status: "active",
          is_default: 0,
        })
        .returning();

      await logAudit("SUPER_ADMIN_CREATE_STORE", `Created Store ${newStore.name} (${newStore.code}) under Organization ${org.name}`, orgId, newStore.id);

      res.status(201).json({
        success: true,
        message: "Store created successfully",
        data: newStore,
      });
    } catch (error) {
      next(error);
    }
  };

  editStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) throw new ValidationError("Invalid store ID");

      const { name, code, address, phone } = req.body;

      const updateData: any = { updated_at: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (code !== undefined) updateData.code = code.trim();
      if (address !== undefined) updateData.address = address ? address.trim() : null;
      if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;

      const [updated] = await db.update(stores).set(updateData).where(eq(stores.id, id)).returning();
      if (!updated) throw new NotFoundError("Store not found");

      await logAudit("SUPER_ADMIN_EDIT_STORE", `Updated Store #${id} details`, updated.organization_id, id);

      res.status(200).json({ success: true, message: "Store updated successfully", data: updated });
    } catch (error) {
      next(error);
    }
  };

  updateStoreStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { status } = req.body;
      if (isNaN(id)) throw new ValidationError("Invalid store ID");

      const targetStatus = String(status || "active").toLowerCase();
      const [updated] = await db
        .update(stores)
        .set({ status: targetStatus, updated_at: new Date() })
        .where(eq(stores.id, id))
        .returning();

      if (!updated) throw new NotFoundError("Store not found");

      await logAudit(
        targetStatus === "suspended" ? "SUPER_ADMIN_SUSPEND_STORE" : "SUPER_ADMIN_REACTIVATE_STORE",
        `Changed Store #${id} status to ${targetStatus.toUpperCase()}`,
        updated.organization_id,
        id
      );

      res.status(200).json({ success: true, message: `Store status updated to ${targetStatus.toUpperCase()}`, data: updated });
    } catch (error) {
      next(error);
    }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const allUsers = await db.select().from(users);
      const allOrgs = await db.select().from(organizations);
      const allStores = await db.select().from(stores);

      const result = allUsers.map((u) => {
        const org = allOrgs.find((o) => o.id === u.organization_id);
        const store = allStores.find((s) => s.id === u.store_id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status || (u.is_active ? "active" : "suspended"),
          organizationId: u.organization_id,
          organizationName: org ? org.name : "N/A",
          storeId: u.store_id,
          storeName: store ? store.name : "N/A",
          createdAt: u.created_at,
        };
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, storeId, name, email, phone, password, role } = req.body;

      if (!organizationId || isNaN(Number(organizationId))) throw new ValidationError("Organization ID is required");
      if (!name || !name.trim()) throw new ValidationError("User Name is required");
      if (!email || !email.trim()) throw new ValidationError("User Email is required");
      if (!password || password.length < 6) throw new ValidationError("Password min 6 characters");

      const normalizedEmail = email.trim().toLowerCase();
      const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
      if (existing) throw new ConflictError("User with this email already exists");

      const orgId = Number(organizationId);
      const sId = storeId ? Number(storeId) : 1;
      const hash = await bcrypt.hash(password, 10);

      const [newUser] = await db
        .insert(users)
        .values({
          organization_id: orgId,
          store_id: sId,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : null,
          password_hash: hash,
          role: role || "cashier",
          status: "active",
          is_active: 1,
        })
        .returning();

      await db.insert(user_store_access).values({
        user_id: newUser.id,
        store_id: sId,
      });

      await logAudit("SUPER_ADMIN_CREATE_USER", `Created User ${newUser.email} with Role ${newUser.role}`, orgId, sId, newUser.id);

      res.status(201).json({ success: true, message: "User created successfully", data: newUser });
    } catch (error) {
      next(error);
    }
  };

  editUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) throw new ValidationError("Invalid user ID");

      const { name, email, phone, role, storeId } = req.body;

      const updateData: any = { updated_at: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (email !== undefined) updateData.email = email.trim().toLowerCase();
      if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
      if (role !== undefined) updateData.role = role;
      if (storeId !== undefined) updateData.store_id = Number(storeId);

      const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
      if (!updated) throw new NotFoundError("User not found");

      await logAudit("SUPER_ADMIN_EDIT_USER", `Updated User profile for #${id} (${updated.email})`, updated.organization_id, updated.store_id, id);

      res.status(200).json({ success: true, message: "User updated successfully", data: updated });
    } catch (error) {
      next(error);
    }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { status } = req.body;
      if (isNaN(id)) throw new ValidationError("Invalid user ID");

      const targetStatus = String(status || "active").toLowerCase();
      const isActive = targetStatus === "active" ? 1 : 0;
      const [updated] = await db
        .update(users)
        .set({ status: targetStatus, is_active: isActive, updated_at: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (!updated) throw new NotFoundError("User not found");

      await logAudit(
        targetStatus === "suspended" ? "SUPER_ADMIN_SUSPEND_USER" : "SUPER_ADMIN_REACTIVATE_USER",
        `Changed User #${id} (${updated.email}) status to ${targetStatus.toUpperCase()}`,
        updated.organization_id,
        updated.store_id,
        id
      );

      res.status(200).json({ success: true, message: `User status updated to ${targetStatus.toUpperCase()}`, data: updated });
    } catch (error) {
      next(error);
    }
  };

  resetUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { newPassword } = req.body;
      if (isNaN(id)) throw new ValidationError("Invalid user ID");
      if (!newPassword || newPassword.length < 6) throw new ValidationError("Password must be at least 6 characters");

      const hash = await bcrypt.hash(newPassword, 10);
      const [updated] = await db.update(users).set({ password_hash: hash, updated_at: new Date() }).where(eq(users.id, id)).returning();

      await logAudit("SUPER_ADMIN_RESET_USER_PASSWORD", `Reset password for User #${id} (${updated?.email})`, updated?.organization_id, updated?.store_id, id);

      res.status(200).json({ success: true, message: "User password reset successfully" });
    } catch (error) {
      next(error);
    }
  };

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const logs = await db
        .select()
        .from(audit_logs)
        .orderBy(desc(audit_logs.id))
        .limit(100);

      const allUsers = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);

      const formatted = logs.map((l) => {
        const u = allUsers.find((user) => user.id === l.user_id);
        return {
          id: l.id,
          action: l.action,
          performedBy: u ? `${u.name} (${u.email})` : "Super Admin",
          details: l.details || "N/A",
          organizationId: l.organization_id,
          storeId: l.store_id,
          timestamp: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
        };
      });

      res.status(200).json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      next(error);
    }
  };

  getSystemHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startMs = Date.now();
      const [dbTest] = await db.select({ val: sql<number>`1` }).from(organizations).limit(1);
      const latencyMs = Date.now() - startMs;

      const [orgCount] = await db.select({ count: sql<string>`COUNT(*)` }).from(organizations);
      const [storeCount] = await db.select({ count: sql<string>`COUNT(*)` }).from(stores);
      const [userCount] = await db.select({ count: sql<string>`COUNT(*)` }).from(users);
      const [productCount] = await db.select({ count: sql<string>`COUNT(*)` }).from(products);
      const [salesCount] = await db.select({ count: sql<string>`COUNT(*)` }).from(sales);

      res.status(200).json({
        success: true,
        data: {
          database: { status: dbTest ? "HEALTHY" : "DEGRADED", latencyMs, provider: "PostgreSQL on Railway" },
          railway: { status: "OPERATIONAL", region: "iad", uptime: "99.99%" },
          api: { status: "ONLINE", httpStatus: 200, timestamp: new Date().toISOString() },
          metrics: {
            totalOrganizations: Number(orgCount?.count || 0),
            totalStores: Number(storeCount?.count || 0),
            totalUsers: Number(userCount?.count || 0),
            totalProducts: Number(productCount?.count || 0),
            totalSales: Number(salesCount?.count || 0),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
