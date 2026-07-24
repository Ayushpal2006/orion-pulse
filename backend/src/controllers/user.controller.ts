import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, stores, user_store_access, audit_logs } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getTenantContext } from "../db/context";
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from "../utils/errors";
import bcrypt from "bcryptjs";

export class UserController {
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = getTenantContext();

      const userRows = await db
        .select({
          id: users.id,
          organization_id: users.organization_id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          store_id: users.store_id,
          is_active: users.is_active,
          status: users.status,
          created_at: users.created_at,
          updated_at: users.updated_at,
        })
        .from(users)
        .where(eq(users.organization_id, organizationId))
        .orderBy(users.id);

      // Fetch store assignments for each user
      const userIds = userRows.map((u) => u.id);
      let accessRows: any[] = [];
      if (userIds.length > 0) {
        accessRows = await db
          .select({
            user_id: user_store_access.user_id,
            store_id: user_store_access.store_id,
            store_name: stores.name,
            store_code: stores.code,
          })
          .from(user_store_access)
          .innerJoin(stores, eq(user_store_access.store_id, stores.id))
          .where(inArray(user_store_access.user_id, userIds));
      }

      const accessMap = new Map<number, any[]>();
      for (const row of accessRows) {
        const list = accessMap.get(row.user_id) || [];
        list.push({ id: row.store_id, name: row.store_name, code: row.store_code });
        accessMap.set(row.user_id, list);
      }

      const result = userRows.map((u) => ({
        ...u,
        assignedStores: accessMap.get(u.id) || [{ id: u.store_id }],
      }));

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { organizationId } = getTenantContext();

      if (isNaN(id)) {
        throw new ValidationError("Invalid user ID");
      }

      const [user] = await db
        .select({
          id: users.id,
          organization_id: users.organization_id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          store_id: users.store_id,
          is_active: users.is_active,
          status: users.status,
          created_at: users.created_at,
          updated_at: users.updated_at,
        })
        .from(users)
        .where(and(eq(users.id, id), eq(users.organization_id, organizationId)))
        .limit(1);

      if (!user) {
        throw new NotFoundError("User not found");
      }

      const accessRows = await db
        .select({
          store_id: user_store_access.store_id,
          store_name: stores.name,
          store_code: stores.code,
        })
        .from(user_store_access)
        .innerJoin(stores, eq(user_store_access.store_id, stores.id))
        .where(eq(user_store_access.user_id, user.id));

      res.status(200).json({
        success: true,
        data: {
          ...user,
          assignedStores: accessRows.map((r) => ({ id: r.store_id, name: r.store_name, code: r.store_code })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, role: currentRole } = getTenantContext();
      const { name, email, phone, password, role, storeId, storeIds } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        throw new ValidationError("User name is required");
      }
      if (!email || typeof email !== "string" || !email.trim()) {
        throw new ValidationError("Email address is required");
      }
      if (!password || typeof password !== "string" || password.length < 6) {
        throw new ValidationError("Password must be at least 6 characters long");
      }

      const normalizedRole = role || "Cashier";
      const normalizedCurrentRole = (currentRole || "").toLowerCase();

      // Manager restriction: Managers cannot create Owners / Admins
      if (
        normalizedCurrentRole.includes("manager") &&
        ["owner", "admin"].includes(normalizedRole.toLowerCase())
      ) {
        throw new ForbiddenError("Managers cannot create Owner or Admin accounts");
      }

      // Check email uniqueness
      const [existingEmail] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.trim().toLowerCase()))
        .limit(1);

      if (existingEmail) {
        throw new ConflictError("A user with this email already exists");
      }

      // Determine default primary store_id
      const assignedStoreIds: number[] = Array.isArray(storeIds) && storeIds.length > 0
        ? storeIds.map((id: any) => parseInt(id, 10)).filter((n: number) => !isNaN(n))
        : [storeId ? parseInt(storeId, 10) : 1];

      const primaryStoreId = assignedStoreIds[0] || 1;

      // Verify assigned stores belong to user's organization
      const validStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(and(eq(stores.organization_id, organizationId), inArray(stores.id, assignedStoreIds)));

      if (validStores.length === 0) {
        throw new ValidationError("Invalid store assignment: Stores do not belong to organization");
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const [createdUser] = await db
        .insert(users)
        .values({
          organization_id: organizationId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ? phone.trim() : null,
          password_hash: passwordHash,
          role: normalizedRole,
          store_id: primaryStoreId,
          is_active: 1,
          status: "active",
        })
        .returning();

      // Insert store access entries
      const validStoreIds = validStores.map((s) => s.id);
      for (const stId of validStoreIds) {
        await db
          .insert(user_store_access)
          .values({
            user_id: createdUser.id,
            store_id: stId,
          })
          .onConflictDoNothing();
      }

      // Record USER_CREATED audit log entry
      try {
        const { userId: creatorUserId } = getTenantContext();
        await db.insert(audit_logs).values({
          organization_id: organizationId,
          store_id: primaryStoreId,
          user_id: creatorUserId || 1,
          action: "USER_CREATED",
          details: `User "${createdUser.name}" (${createdUser.email}) created with role "${createdUser.role}"`,
        });
      } catch (e) {
        // non-blocking
      }

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          store_id: createdUser.store_id,
          assignedStoreIds: validStoreIds,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = parseInt(req.params.id as string, 10);
      const { userId: currentUserId, organizationId, role: currentRole } = getTenantContext();

      if (isNaN(targetUserId)) {
        throw new ValidationError("Invalid user ID");
      }

      const { name, email, phone, password, role, status, is_active, storeIds } = req.body;

      // Fetch target user
      const [targetUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, targetUserId), eq(users.organization_id, organizationId)))
        .limit(1);

      if (!targetUser) {
        throw new NotFoundError("User not found in organization");
      }

      const normalizedCurrentRole = (currentRole || "").toLowerCase();
      if (
        normalizedCurrentRole.includes("manager") &&
        ["owner", "admin"].includes(targetUser.role.toLowerCase())
      ) {
        throw new ForbiddenError("Managers cannot modify Owner or Admin accounts");
      }

      // Last owner protection
      const isTargetOwner = ["owner", "admin"].includes(targetUser.role.toLowerCase());
      const isRoleChanging = role && role.toLowerCase() !== targetUser.role.toLowerCase();
      const isDisabling = status === "disabled" || is_active === 0;

      if (isTargetOwner && (isRoleChanging || isDisabling)) {
        const allOwners = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.organization_id, organizationId),
              inArray(users.role, ["Owner", "Admin", "owner", "admin"]),
              eq(users.status, "active")
            )
          );

        if (allOwners.length <= 1) {
          throw new ValidationError("Cannot disable or change role of the last remaining Owner");
        }
      }

      // Owner self-disabling protection
      if (currentUserId === targetUserId && isDisabling) {
        throw new ValidationError("You cannot disable your own account");
      }

      const updateData: any = { updated_at: new Date() };

      if (name !== undefined) updateData.name = name.trim();
      if (email !== undefined && email.trim().toLowerCase() !== targetUser.email) {
        const [dup] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email.trim().toLowerCase()))
          .limit(1);
        if (dup) throw new ConflictError("Email already in use by another account");
        updateData.email = email.trim().toLowerCase();
      }
      if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
      if (password && typeof password === "string" && password.length >= 6) {
        updateData.password_hash = await bcrypt.hash(password, 10);
      }
      if (role !== undefined) updateData.role = role;
      if (status !== undefined) {
        updateData.status = status;
        updateData.is_active = status === "active" ? 1 : 0;
      }
      if (is_active !== undefined) {
        updateData.is_active = is_active;
        updateData.status = is_active === 1 ? "active" : "disabled";
      }

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(and(eq(users.id, targetUserId), eq(users.organization_id, organizationId)))
        .returning();

      // Update store access if storeIds provided
      if (Array.isArray(storeIds)) {
        const assignedStoreIds: number[] = storeIds.map((id: any) => parseInt(id, 10)).filter((n: number) => !isNaN(n));
        const validStores = await db
          .select({ id: stores.id })
          .from(stores)
          .where(and(eq(stores.organization_id, organizationId), inArray(stores.id, assignedStoreIds)));

        const validStoreIds = validStores.map((s) => s.id);

        // Delete existing access entries and re-insert
        await db.delete(user_store_access).where(eq(user_store_access.user_id, targetUserId));
        for (const stId of validStoreIds) {
          await db.insert(user_store_access).values({ user_id: targetUserId, store_id: stId }).onConflictDoNothing();
        }

        if (validStoreIds.length > 0 && !validStoreIds.includes(updatedUser.store_id)) {
          await db.update(users).set({ store_id: validStoreIds[0] }).where(eq(users.id, targetUserId));
        }
      }

      res.status(200).json({ success: true, message: "User updated successfully", data: updatedUser });
    } catch (error) {
      next(error);
    }
  };

  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = parseInt(req.params.id as string, 10);
      const { userId: currentUserId, organizationId } = getTenantContext();

      if (isNaN(targetUserId)) {
        throw new ValidationError("Invalid user ID");
      }

      if (currentUserId === targetUserId) {
        throw new ValidationError("You cannot disable your own account");
      }

      const [targetUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, targetUserId), eq(users.organization_id, organizationId)))
        .limit(1);

      if (!targetUser) {
        throw new NotFoundError("User not found");
      }

      if (["owner", "admin"].includes(targetUser.role.toLowerCase())) {
        const allOwners = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.organization_id, organizationId),
              inArray(users.role, ["Owner", "Admin", "owner", "admin"]),
              eq(users.status, "active")
            )
          );

        if (allOwners.length <= 1) {
          throw new ValidationError("Cannot disable the last remaining Owner of the organization");
        }
      }

      const [updated] = await db
        .update(users)
        .set({ status: "disabled", is_active: 0, updated_at: new Date() })
        .where(and(eq(users.id, targetUserId), eq(users.organization_id, organizationId)))
        .returning();

      res.status(200).json({ success: true, message: "User disabled successfully", data: updated });
    } catch (error) {
      next(error);
    }
  };

  assignStores = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = parseInt(req.params.id as string, 10);
      const { organizationId } = getTenantContext();
      const { storeIds } = req.body;

      if (isNaN(targetUserId)) {
        throw new ValidationError("Invalid user ID");
      }
      if (!Array.isArray(storeIds)) {
        throw new ValidationError("storeIds must be an array of store IDs");
      }

      const parsedStoreIds: number[] = storeIds.map((id: any) => parseInt(id, 10)).filter((n: number) => !isNaN(n));

      // Verify user exists in org
      const [targetUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, targetUserId), eq(users.organization_id, organizationId)))
        .limit(1);

      if (!targetUser) {
        throw new NotFoundError("User not found");
      }

      // Verify valid stores
      const validStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(and(eq(stores.organization_id, organizationId), inArray(stores.id, parsedStoreIds)));

      const validStoreIds = validStores.map((s) => s.id);

      await db.delete(user_store_access).where(eq(user_store_access.user_id, targetUserId));
      for (const stId of validStoreIds) {
        await db.insert(user_store_access).values({ user_id: targetUserId, store_id: stId }).onConflictDoNothing();
      }

      if (validStoreIds.length > 0 && !validStoreIds.includes(targetUser.store_id)) {
        await db.update(users).set({ store_id: validStoreIds[0] }).where(eq(users.id, targetUserId));
      }

      res.status(200).json({
        success: true,
        message: "Store access assigned successfully",
        data: { userId: targetUserId, assignedStoreIds: validStoreIds },
      });
    } catch (error) {
      next(error);
    }
  };
}
