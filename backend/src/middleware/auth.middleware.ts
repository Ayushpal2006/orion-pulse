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
      return res.status(401).json({ success: false, error: "Access token is missing or invalid" });
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
    } catch (err) {
      logger.error("Authentication token verification failed:", err);
      return res.status(401).json({ success: false, error: "Access token is expired or invalid" });
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
