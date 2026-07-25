import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { organizations, organization_invitations, users, stores, api_keys, support_tickets, sales, products, audit_logs } from "../db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getTenantContext, getStoreId } from "../db/context";
import { ValidationError, NotFoundError, ForbiddenError } from "../utils/errors";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export class OrganizationController {
  getCurrent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = getTenantContext();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org) {
        throw new NotFoundError("Organization not found");
      }

      const userRows = await db
        .select({ id: users.id, is_active: users.is_active, status: users.status })
        .from(users)
        .where(eq(users.organization_id, organizationId));

      const storeRows = await db
        .select({ id: stores.id, status: stores.status })
        .from(stores)
        .where(eq(stores.organization_id, organizationId));

      const totalUsers = userRows.length;
      const activeUsers = userRows.filter((u) => u.is_active === 1 && u.status === "active").length;
      const disabledUsers = totalUsers - activeUsers;

      const totalStores = storeRows.length;
      const activeStores = storeRows.filter((s) => s.status === "active").length;

      res.status(200).json({
        success: true,
        data: {
          ...org,
          stats: {
            totalUsers,
            activeUsers,
            disabledUsers,
            totalStores,
            activeStores,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateCurrent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, organizationId, role } = getTenantContext();
      const isOwnerOrAdmin = ["owner", "admin"].includes((role || "").toLowerCase());

      if (!isOwnerOrAdmin) {
        throw new ForbiddenError("Only Organization Owners or Admins can modify organization settings");
      }

      const {
        name,
        phone,
        email,
        gstNumber,
        panNumber,
        address,
        logoUrl,
        currency,
        timezone,
        invoicePrefix,
        financialYear,
        receiptInfo,
      } = req.body;

      const updateData: any = { updated_at: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
      if (email !== undefined) updateData.email = email ? email.trim() : null;
      if (gstNumber !== undefined) updateData.gst_number = gstNumber ? gstNumber.trim() : null;
      if (panNumber !== undefined) updateData.pan_number = panNumber ? panNumber.trim() : null;
      if (address !== undefined) updateData.address = address ? address.trim() : null;
      if (logoUrl !== undefined) updateData.logo_url = logoUrl ? logoUrl.trim() : null;
      if (currency !== undefined) updateData.currency = currency;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (invoicePrefix !== undefined) updateData.invoice_prefix = invoicePrefix;
      if (financialYear !== undefined) updateData.financial_year = financialYear;
      if (receiptInfo !== undefined) updateData.receipt_info = receiptInfo;

      const [updated] = await db
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, organizationId))
        .returning();

      // Record Audit Entry
      try {
        await db.insert(audit_logs).values({
          organization_id: organizationId,
          store_id: getTenantContext().currentStoreId || 1,
          user_id: userId,
          action: "ORGANIZATION_UPDATED",
          details: `Organization updated by User #${userId}: ${Object.keys(updateData).filter((k) => k !== "updated_at").join(", ")}`,
        });
      } catch (auditErr) {
        // non-blocking audit write failure
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

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = getTenantContext();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      const storeRows = await db
        .select({ id: stores.id })
        .from(stores)
        .where(and(eq(stores.organization_id, organizationId), eq(stores.status, "active")));

      const userRows = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.organization_id, organizationId), eq(users.status, "active")));

      // Today's Sales
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [todayResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(total_amount), 0)` })
        .from(sales)
        .where(and(eq(sales.organization_id, organizationId), gte(sales.created_at, todayStart)));

      // Monthly Sales
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [monthResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(total_amount), 0)` })
        .from(sales)
        .where(and(eq(sales.organization_id, organizationId), gte(sales.created_at, monthStart)));

      // Inventory Value
      const [invResult] = await db
        .select({ value: sql<string>`COALESCE(SUM(stock * purchase_price), 0)` })
        .from(products)
        .where(and(eq(products.organization_id, organizationId), eq(products.is_active, 1)));

      // Recent Audit Logs
      const recentAudit = await db
        .select()
        .from(audit_logs)
        .where(eq(audit_logs.organization_id, organizationId))
        .orderBy(sql`${audit_logs.id} DESC`)
        .limit(10);

      res.status(200).json({
        success: true,
        data: {
          organizationName: org ? org.name : "Apka Bill Organization",
          activeStores: storeRows.length,
          activeUsers: userRows.length,
          todaySales: Number(todayResult?.total || 0),
          monthlySales: Number(monthResult?.total || 0),
          inventoryValue: Number(invResult?.value || 0),
          auditLogs: recentAudit,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = getTenantContext();

      const userRows = await db
        .select({ id: users.id, is_active: users.is_active, status: users.status })
        .from(users)
        .where(eq(users.organization_id, organizationId));

      const storeRows = await db
        .select({ id: stores.id, status: stores.status })
        .from(stores)
        .where(eq(stores.organization_id, organizationId));

      const totalUsers = userRows.length;
      const activeUsers = userRows.filter((u) => u.is_active === 1 && u.status === "active").length;
      const disabledUsers = totalUsers - activeUsers;

      const totalStores = storeRows.length;
      const activeStores = storeRows.filter((s) => s.status === "active").length;

      res.status(200).json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          disabledUsers,
          totalStores,
          activeStores,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, billingPlan } = req.body;
      if (!name) {
        throw new ValidationError("Organization name is required");
      }

      const [org] = await db
        .insert(organizations)
        .values({
          name,
          billing_plan: billingPlan || "Basic",
          subscription_status: "active",
        })
        .returning();

      res.status(201).json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  };

  inviteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, role } = req.body;
      if (!email) {
        throw new ValidationError("Invite email is required");
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { organizationId } = getTenantContext();

      const [invitation] = await db
        .insert(organization_invitations)
        .values({
          organization_id: organizationId,
          email,
          role: role || "Manager",
          token,
          status: "pending",
          expires_at: expiresAt,
        })
        .returning();

      res.status(201).json({
        success: true,
        message: "Invitation generated successfully",
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          expiresAt: invitation.expires_at.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, name, password } = req.body;
      if (!token || !name || !password) {
        throw new ValidationError("Token, name, and password are required to accept invitation");
      }

      const [invite] = await db
        .select()
        .from(organization_invitations)
        .where(and(eq(organization_invitations.token, token), eq(organization_invitations.status, "pending")))
        .limit(1);

      if (!invite) {
        throw new NotFoundError("Invitation token is invalid or already accepted");
      }

      if (invite.expires_at < new Date()) {
        await db
          .update(organization_invitations)
          .set({ status: "expired" })
          .where(eq(organization_invitations.id, invite.id));
        throw new ValidationError("Invitation token has expired");
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          organization_id: invite.organization_id,
          name,
          email: invite.email,
          password_hash: passwordHash,
          role: invite.role,
          store_id: 1,
          is_active: 1,
        });

        await tx
          .update(organization_invitations)
          .set({ status: "accepted" })
          .where(eq(organization_invitations.id, invite.id));
      });

      res.status(200).json({ success: true, message: "Invitation accepted successfully. Account created." });
    } catch (error) {
      next(error);
    }
  };

  createApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, currentStoreId } = getTenantContext();
      const { name, scopes } = req.body;
      if (!name) {
        throw new ValidationError("API Key name is required");
      }

      const rawKey = "op_live_" + crypto.randomBytes(24).toString("hex");
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const prefix = rawKey.substring(0, 12);

      const [apiKey] = await db
        .insert(api_keys)
        .values({
          organization_id: organizationId,
          store_id: currentStoreId,
          name,
          key_hash: keyHash,
          prefix,
          scopes: scopes || "read:sales",
          is_active: 1,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          scopes: apiKey.scopes,
          apiKey: rawKey,
          createdAt: apiKey.created_at.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  listApiKeys = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentStoreId } = getTenantContext();
      const keys = await db
        .select()
        .from(api_keys)
        .where(and(eq(api_keys.store_id, currentStoreId), eq(api_keys.is_active, 1)));

      res.status(200).json({ success: true, data: keys });
    } catch (error) {
      next(error);
    }
  };

  deleteApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { currentStoreId } = getTenantContext();
      if (isNaN(id)) {
        throw new ValidationError("Invalid API Key ID");
      }

      await db
        .update(api_keys)
        .set({ is_active: 0 })
        .where(and(eq(api_keys.id, id), eq(api_keys.store_id, currentStoreId)));

      res.status(200).json({ success: true, message: "API key deactivated successfully" });
    } catch (error) {
      next(error);
    }
  };

  createTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, currentStoreId } = getTenantContext();
      const { subject, description, priority } = req.body;
      if (!subject || !description) {
        throw new ValidationError("Subject and description are required for support tickets");
      }

      const [ticket] = await db
        .insert(support_tickets)
        .values({
          organization_id: organizationId,
          store_id: currentStoreId,
          subject,
          description,
          status: "Open",
          priority: priority || "Medium",
        })
        .returning();

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  };

  listTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentStoreId } = getTenantContext();
      const tickets = await db
        .select()
        .from(support_tickets)
        .where(eq(support_tickets.store_id, currentStoreId));

      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  };

  completeOnboarding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, organizationId, currentStoreId } = getTenantContext();
      const {
        businessName,
        ownerName,
        phone,
        email,
        gstNumber,
        address,
        storeName,
        storeAddress,
        storePhone,
        invoicePrefix,
        receiptInfo,
      } = req.body;

      if (!businessName || !businessName.trim()) {
        throw new ValidationError("Business Name is required");
      }
      if (!storeName || !storeName.trim()) {
        throw new ValidationError("Store Name is required");
      }
      if (!ownerName || !ownerName.trim()) {
        throw new ValidationError("Owner Name is required");
      }
      if (!phone || !phone.trim()) {
        throw new ValidationError("Mobile / Phone Number is required");
      }

      // Update organization
      const [updatedOrg] = await db
        .update(organizations)
        .set({
          name: businessName.trim(),
          phone: phone.trim(),
          email: email ? email.trim() : undefined,
          gst_number: gstNumber ? gstNumber.trim() : undefined,
          address: address ? address.trim() : undefined,
          invoice_prefix: invoicePrefix ? invoicePrefix.trim() : "INV-",
          receipt_info: receiptInfo ? receiptInfo.trim() : undefined,
          onboarding_completed: 1,
          updated_at: new Date(),
        })
        .where(eq(organizations.id, organizationId))
        .returning();

      // Update owner user
      await db
        .update(users)
        .set({
          name: ownerName.trim(),
          phone: phone.trim(),
          email: email ? email.trim() : undefined,
          updated_at: new Date(),
        })
        .where(eq(users.id, userId));

      // Update primary store
      await db
        .update(stores)
        .set({
          name: storeName.trim(),
          address: storeAddress ? storeAddress.trim() : address ? address.trim() : undefined,
          phone: storePhone ? storePhone.trim() : phone.trim(),
          updated_at: new Date(),
        })
        .where(and(eq(stores.id, currentStoreId || 1), eq(stores.organization_id, organizationId)));

      res.status(200).json({
        success: true,
        message: "Onboarding completed successfully",
        data: updatedOrg,
      });
    } catch (error) {
      next(error);
    }
  };

  resetOnboarding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = getTenantContext();

      const [updatedOrg] = await db
        .update(organizations)
        .set({ onboarding_completed: 0, updated_at: new Date() })
        .where(eq(organizations.id, organizationId))
        .returning();

      res.status(200).json({
        success: true,
        message: "Onboarding wizard reset successfully",
        data: updatedOrg,
      });
    } catch (error) {
      next(error);
    }
  };
}
