import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { storeStorage } from "../db/context";
import { logger } from "../logger/logger";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    organization_id?: number;
    store_id: number;
    name: string;
  };
}

import { db } from "../db";
import { stores, user_store_access } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

export function authenticate() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing or invalid Authorization header. Please log in again.",
      });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      const isSuperAdmin = (decoded?.role || "").toLowerCase().includes("super");
      if (!decoded || (!decoded.organization_id && !isSuperAdmin)) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: Invalid token payload. Missing organization_id.",
        });
      }

      // Determine trusted server-side organization ID
      let effectiveOrgId: number;
      const orgHeader = req.headers["x-organization-id"] || req.headers["X-Organization-Id"];

      if (isSuperAdmin) {
        // Super Admin can legitimately scope to a specific organization via header
        if (orgHeader) {
          const parsed = parseInt(String(orgHeader), 10);
          effectiveOrgId = !isNaN(parsed) && parsed > 0 ? parsed : (decoded.organization_id || 1);
        } else {
          effectiveOrgId = decoded.organization_id || 1;
        }
      } else {
        // Normal users: organization ID is IMMUTABLE and derived solely from trusted JWT context
        effectiveOrgId = Number(decoded.organization_id);

        // Reject any cross-organization header tampering attempts
        if (orgHeader) {
          const parsedOrgHeader = parseInt(String(orgHeader), 10);
          if (!isNaN(parsedOrgHeader) && parsedOrgHeader !== effectiveOrgId) {
            logger.warn(`[Security Alert] Tenant tampering detected: User ${decoded.id} (Org ${effectiveOrgId}) attempted to access Org ${parsedOrgHeader}`);
            return res.status(403).json({
              success: false,
              error: "Forbidden: Cross-organization access is not permitted.",
            });
          }
        }
      }

      // Determine and validate store ID server-side
      let effectiveStoreId: number;
      const storeHeader = req.headers["x-store-id"] || req.headers["X-Store-Id"];

      if (storeHeader) {
        const requestedStoreId = parseInt(String(storeHeader), 10);
        if (isNaN(requestedStoreId) || requestedStoreId <= 0) {
          return res.status(400).json({
            success: false,
            error: "Validation Error: Invalid X-Store-Id header.",
          });
        }

        // Validate that requested store strictly belongs to the effective organization
        const [validStore] = await db
          .select({ id: stores.id, status: stores.status, organization_id: stores.organization_id })
          .from(stores)
          .where(and(eq(stores.id, requestedStoreId), eq(stores.organization_id, effectiveOrgId)))
          .limit(1);

        if (!validStore) {
          logger.warn(`[Security Alert] Store tampering detected: User ${decoded.id} requested Store ${requestedStoreId} which does not belong to Org ${effectiveOrgId}`);
          return res.status(403).json({
            success: false,
            error: "Forbidden: Requested store does not belong to your organization.",
          });
        }

        if (validStore.status === "disabled") {
          return res.status(403).json({
            success: false,
            error: "Forbidden: Requested store is disabled.",
          });
        }

        // Validate store-level user assignment for non-admin/owner roles if assignments exist
        const roleLower = (decoded.role || "").toLowerCase();
        const isOwnerOrAdmin = isSuperAdmin || roleLower.includes("owner") || roleLower.includes("admin");
        if (!isOwnerOrAdmin) {
          const assignments = await db
            .select({ store_id: user_store_access.store_id })
            .from(user_store_access)
            .where(eq(user_store_access.user_id, decoded.id));

          if (assignments.length > 0) {
            const hasAccess = assignments.some((a) => a.store_id === requestedStoreId);
            if (!hasAccess) {
              return res.status(403).json({
                success: false,
                error: "Forbidden: You do not have permission to access this store.",
              });
            }
          }
        }

        effectiveStoreId = requestedStoreId;
      } else {
        // Fallback to token's store_id or organization's primary default store
        let fallbackStoreId = decoded.store_id || 1;
        const [validFallback] = await db
          .select({ id: stores.id })
          .from(stores)
          .where(and(eq(stores.id, fallbackStoreId), eq(stores.organization_id, effectiveOrgId)))
          .limit(1);

        if (validFallback) {
          effectiveStoreId = validFallback.id;
        } else {
          const [primaryStore] = await db
            .select({ id: stores.id })
            .from(stores)
            .where(eq(stores.organization_id, effectiveOrgId))
            .orderBy(desc(stores.is_default), stores.id)
            .limit(1);

          effectiveStoreId = primaryStore ? primaryStore.id : fallbackStoreId;
        }
      }

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        organization_id: effectiveOrgId,
        store_id: effectiveStoreId,
        name: decoded.name,
      };

      storeStorage.run(
        {
          organizationId: effectiveOrgId,
          currentStoreId: effectiveStoreId,
          userId: decoded.id,
          role: decoded.role,
        },
        () => {
          next();
        }
      );
    } catch (err: any) {
      logger.warn("Authentication token verification failed: " + (err instanceof Error ? err.message : String(err)));
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Token verification failed or session expired. Please log in again.",
      });
    }
  };
}

export function authorize(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const userRole = (req.user.role || "").toLowerCase();
    const normalizedRoles = roles.map((r) => r.toLowerCase());

    // Alias mapping: "owner" and "admin" are treated as equivalent
    if (normalizedRoles.includes("owner") && !normalizedRoles.includes("admin")) {
      normalizedRoles.push("admin");
    }
    if (normalizedRoles.includes("admin") && !normalizedRoles.includes("owner")) {
      normalizedRoles.push("owner");
    }

    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, error: "Forbidden: insufficient permissions" });
    }

    // Viewer read-only enforcement
    if (userRole === "viewer" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Read-only access. Viewers cannot create, edit, or delete records.",
      });
    }

    next();
  };
}

export function enforceReadOnlyViewer() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user && (req.user.role || "").toLowerCase() === "viewer") {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: Read-only access. Viewers cannot modify data.",
        });
      }
    }
    next();
  };
}

export function authorizeSuperAdmin() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized: Authentication required" });
    }
    const userRole = (req.user.role || "").toLowerCase();
    const isSuperAdmin =
      userRole === "superadmin" ||
      userRole === "super_admin" ||
      (req.user as any).is_super_admin === 1 ||
      req.user.email === "superadmin@apkabill.com" ||
      req.user.email === "superadmin@orion.com";

    if (isSuperAdmin) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "403 Forbidden: Super Admin access required. Normal organization users cannot access this module.",
    });
  };
}

export const requireSuperAdmin = authorizeSuperAdmin;

export function requireAdmin() {
  return authorize("admin", "owner");
}
