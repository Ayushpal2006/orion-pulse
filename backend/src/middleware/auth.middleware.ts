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

function resolveStoreId(req: Request, fallbackStoreId: number): number {
  const headerVal = req.headers["x-store-id"] || req.headers["X-Store-Id"];
  if (headerVal) {
    const parsed = parseInt(String(headerVal), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallbackStoreId;
}

function resolveOrganizationId(req: Request, fallbackOrgId: number, role: string): number {
  const headerVal = req.headers["x-organization-id"] || req.headers["X-Organization-Id"];
  if (headerVal && ["super_admin", "superadmin", "owner", "admin"].includes((role || "").toLowerCase())) {
    const parsed = parseInt(String(headerVal), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallbackOrgId;
}

import { db } from "../db";
import { stores } from "../db/schema";
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

      const baseStoreId = decoded.store_id || 1;
      const requestedOrgId = resolveOrganizationId(req, decoded.organization_id, decoded.role || "");
      let requestedStoreId = resolveStoreId(req, baseStoreId);

      // Verify that requestedStoreId actually belongs to requestedOrgId
      try {
        const [validStore] = await db
          .select({ id: stores.id })
          .from(stores)
          .where(and(eq(stores.id, requestedStoreId), eq(stores.organization_id, requestedOrgId)))
          .limit(1);

        if (!validStore) {
          const [primaryStore] = await db
            .select({ id: stores.id })
            .from(stores)
            .where(eq(stores.organization_id, requestedOrgId))
            .orderBy(desc(stores.is_default), stores.id)
            .limit(1);

          if (primaryStore) {
            requestedStoreId = primaryStore.id;
          }
        }
      } catch (dbErr) {
        logger.warn("Store validation failed in auth middleware: " + String(dbErr));
      }

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        organization_id: requestedOrgId,
        store_id: requestedStoreId,
        name: decoded.name,
      };

      storeStorage.run(
        {
          organizationId: req.user.organization_id,
          currentStoreId: req.user.store_id,
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
