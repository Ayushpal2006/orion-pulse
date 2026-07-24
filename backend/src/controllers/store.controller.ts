import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { stores, users, sales, products, purchase_orders, expenses, inventory_adjustments, user_store_access, audit_logs } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getTenantContext } from "../db/context";
import { ValidationError, NotFoundError, ForbiddenError } from "../utils/errors";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export class StoreController {
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, organizationId, role } = getTenantContext();
      const isOwnerOrAdmin = ["owner", "admin"].includes((role || "").toLowerCase());

      let storeRows: any[] = [];
      if (isOwnerOrAdmin) {
        storeRows = await db
          .select()
          .from(stores)
          .where(eq(stores.organization_id, organizationId))
          .orderBy(stores.id);
      } else {
        const assigned = await db
          .select({ store: stores })
          .from(user_store_access)
          .innerJoin(stores, eq(user_store_access.store_id, stores.id))
          .where(and(eq(user_store_access.user_id, userId), eq(stores.organization_id, organizationId)));

        storeRows = assigned.map((a) => a.store);
        if (storeRows.length === 0) {
          const { currentStoreId } = getTenantContext();
          storeRows = await db
            .select()
            .from(stores)
            .where(and(eq(stores.id, currentStoreId), eq(stores.organization_id, organizationId)));
        }
      }

      res.status(200).json({ success: true, data: storeRows });
    } catch (error) {
      next(error);
    }
  };

  getCurrent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, currentStoreId } = getTenantContext();

      const [store] = await db
        .select()
        .from(stores)
        .where(and(eq(stores.id, currentStoreId), eq(stores.organization_id, organizationId)))
        .limit(1);

      if (!store) {
        throw new NotFoundError("Current store not found");
      }

      res.status(200).json({ success: true, data: store });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { organizationId } = getTenantContext();

      if (isNaN(id)) {
        throw new ValidationError("Invalid store ID");
      }

      const [store] = await db
        .select()
        .from(stores)
        .where(and(eq(stores.id, id), eq(stores.organization_id, organizationId)))
        .limit(1);

      if (!store) {
        throw new NotFoundError("Store not found");
      }

      res.status(200).json({ success: true, data: store });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = getTenantContext();
      const { name, code, address, city, state, country, gstNumber, phone, currency, timezone } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        throw new ValidationError("Store name is required");
      }

      // Check existing stores count for organization to mark default if first store
      const existing = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.organization_id, organizationId));

      const isDefault = existing.length === 0 ? 1 : 0;

      const [created] = await db
        .insert(stores)
        .values({
          organization_id: organizationId,
          name: name.trim(),
          code: code ? code.trim() : `STR-${Date.now().toString().slice(-4)}`,
          address: address ? address.trim() : null,
          city: city ? city.trim() : null,
          state: state ? state.trim() : null,
          country: country ? country.trim() : "India",
          gst_number: gstNumber ? gstNumber.trim() : null,
          phone: phone ? phone.trim() : null,
          currency: currency || "INR",
          timezone: timezone || "Asia/Kolkata",
          is_default: isDefault,
          status: "active",
        })
        .returning();

      // Record STORE_CREATED audit log
      try {
        const { userId } = getTenantContext();
        await db.insert(audit_logs).values({
          organization_id: organizationId,
          store_id: created.id,
          user_id: userId || 1,
          action: "STORE_CREATED",
          details: `Store "${created.name}" (${created.code || `ID: #${created.id}`}) created`,
        });
      } catch (e) {
        // non-blocking
      }

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { organizationId } = getTenantContext();

      if (isNaN(id)) {
        throw new ValidationError("Invalid store ID");
      }

      const { name, code, address, city, state, country, gstNumber, phone, currency, timezone, status } = req.body;

      const updateData: any = { updated_at: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (code !== undefined) updateData.code = code.trim();
      if (address !== undefined) updateData.address = address ? address.trim() : null;
      if (city !== undefined) updateData.city = city ? city.trim() : null;
      if (state !== undefined) updateData.state = state ? state.trim() : null;
      if (country !== undefined) updateData.country = country ? country.trim() : null;
      if (gstNumber !== undefined) updateData.gst_number = gstNumber ? gstNumber.trim() : null;
      if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
      if (currency !== undefined) updateData.currency = currency;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (status !== undefined) {
        if (!["active", "disabled"].includes(status)) {
          throw new ValidationError("Status must be either 'active' or 'disabled'");
        }
        updateData.status = status;
      }

      const [updated] = await db
        .update(stores)
        .set(updateData)
        .where(and(eq(stores.id, id), eq(stores.organization_id, organizationId)))
        .returning();

      if (!updated) {
        throw new NotFoundError("Store not found");
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { organizationId } = getTenantContext();

      if (isNaN(id)) {
        throw new ValidationError("Invalid store ID");
      }

      // Check if store exists
      const [existing] = await db
        .select()
        .from(stores)
        .where(and(eq(stores.id, id), eq(stores.organization_id, organizationId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError("Store not found");
      }

      // Prevent disabling default store if it's the only store
      const allStores = await db
        .select({ id: stores.id })
        .from(stores)
        .where(and(eq(stores.organization_id, organizationId), eq(stores.status, "active")));

      if (allStores.length <= 1 && existing.status === "active") {
        throw new ValidationError("Cannot disable the only active store in organization");
      }

      // Soft disable store
      const [updated] = await db
        .update(stores)
        .set({ status: "disabled", updated_at: new Date() })
        .where(and(eq(stores.id, id), eq(stores.organization_id, organizationId)))
        .returning();

      res.status(200).json({ success: true, message: "Store disabled successfully", data: updated });
    } catch (error) {
      next(error);
    }
  };

  switchStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, organizationId, role } = getTenantContext();
      const { storeId } = req.body;

      const targetStoreId = parseInt(storeId, 10);
      if (isNaN(targetStoreId)) {
        throw new ValidationError("Target storeId is required and must be a number");
      }

      // Verify store belongs to user's organization and is active
      const [targetStore] = await db
        .select()
        .from(stores)
        .where(and(eq(stores.id, targetStoreId), eq(stores.organization_id, organizationId)))
        .limit(1);

      if (!targetStore) {
        throw new ForbiddenError("Unauthorized access: Store does not belong to your organization");
      }

      if (targetStore.status === "disabled") {
        throw new ForbiddenError("Cannot switch to a disabled store");
      }

      // Verify store access for non-Owner/Admin users
      const isOwnerOrAdmin = ["owner", "admin"].includes((role || "").toLowerCase());
      if (!isOwnerOrAdmin) {
        const [access] = await db
          .select()
          .from(user_store_access)
          .where(and(eq(user_store_access.user_id, userId), eq(user_store_access.store_id, targetStoreId)))
          .limit(1);

        if (!access) {
          throw new ForbiddenError("Unauthorized store access: You are not assigned to this store");
        }
      }

      // Update user's preferred store_id in database
      await db
        .update(users)
        .set({ store_id: targetStoreId, updated_at: new Date() })
        .where(eq(users.id, userId));

      // Fetch user info to generate new token
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const tokenPayload = {
        id: user ? user.id : userId,
        email: user ? user.email : "admin@orion.com",
        role: user ? user.role : "admin",
        organization_id: organizationId,
        store_id: targetStoreId,
        name: user ? user.name : "Admin",
      };

      const token = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: "7d" });

      res.status(200).json({
        success: true,
        message: `Successfully switched to store: ${targetStore.name}`,
        data: {
          store: targetStore,
          currentStoreId: targetStoreId,
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
