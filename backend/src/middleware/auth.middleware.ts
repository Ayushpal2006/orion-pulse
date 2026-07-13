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
    store_id: number;
    name: string;
  };
}

export function authenticate() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // In V1, default to the seeded admin user context so frontend operations bypass login
      const defaultUser = {
        id: 1,
        email: "admin@orion.com",
        role: "admin",
        store_id: 1,
        name: "Default Admin",
      };
      req.user = defaultUser;
      return storeStorage.run(
        { storeId: defaultUser.store_id, userId: defaultUser.id, role: defaultUser.role },
        () => {
          next();
        }
      );
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        store_id: decoded.store_id,
        name: decoded.name,
      };

      storeStorage.run(
        { storeId: decoded.store_id, userId: decoded.id, role: decoded.role },
        () => {
          next();
        }
      );
    } catch (err: any) {
      logger.warn("Authentication token verification failed, falling back to default admin context for V1: " + (err instanceof Error ? err.message : String(err)));
      const defaultUser = {
        id: 1,
        email: "admin@orion.com",
        role: "admin",
        store_id: 1,
        name: "Default Admin",
      };
      req.user = defaultUser;
      return storeStorage.run(
        { storeId: defaultUser.store_id, userId: defaultUser.id, role: defaultUser.role },
        () => {
          next();
        }
      );
    }
  };
}

export function authorize(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Forbidden: insufficient permissions" });
    }
    next();
  };
}
