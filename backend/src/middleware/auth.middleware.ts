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

export function authenticate() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // In V1, default to the seeded admin user context so frontend operations bypass login
      const storeId = resolveStoreId(req, 1);
      const defaultUser = {
        id: 1,
        email: "admin@orion.com",
        role: "admin",
        organization_id: 1,
        store_id: storeId,
        name: "Default Admin",
      };
      req.user = defaultUser;
      return storeStorage.run(
        { organizationId: defaultUser.organization_id, currentStoreId: defaultUser.store_id, userId: defaultUser.id, role: defaultUser.role },
        () => {
          next();
        }
      );
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      const baseStoreId = decoded.store_id || 1;
      const storeId = resolveStoreId(req, baseStoreId);

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        organization_id: decoded.organization_id || 1,
        store_id: storeId,
        name: decoded.name,
      };

      storeStorage.run(
        { organizationId: req.user.organization_id, currentStoreId: req.user.store_id, userId: decoded.id, role: decoded.role },
        () => {
          next();
        }
      );
    } catch (err: any) {
      logger.warn("Authentication token verification failed, falling back to default admin context for V1: " + (err instanceof Error ? err.message : String(err)));
      const storeId = resolveStoreId(req, 1);
      const defaultUser = {
        id: 1,
        email: "admin@orion.com",
        role: "admin",
        organization_id: 1,
        store_id: storeId,
        name: "Default Admin",
      };
      req.user = defaultUser;
      return storeStorage.run(
        { organizationId: defaultUser.organization_id, currentStoreId: defaultUser.store_id, userId: defaultUser.id, role: defaultUser.role },
        () => {
          next();
        }
      );
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
      userRole === "owner" ||
      userRole === "admin" ||
      (req.user as any).is_super_admin === 1 ||
      req.user.email === "superadmin@apkabill.com" ||
      req.user.email === "admin@orion.com";

    if (isSuperAdmin) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "403 Forbidden: Super Admin access required. Normal organization users cannot access this module.",
    });
  };
}
