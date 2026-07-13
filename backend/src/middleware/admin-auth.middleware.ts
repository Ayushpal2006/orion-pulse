import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import { logger } from "../logger/logger";

// Self-contained HS256 JWT verification helper to avoid external dependencies
export function verifyHS256JWT(token: string, secret: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token structure");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  
  // Verify signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const expectedSignatureB64 = hmac.digest("base64url");
  
  if (signatureB64 !== expectedSignatureB64) {
    throw new Error("Invalid signature");
  }
  
  // Parse payload
  const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
  return JSON.parse(payloadStr);
}

// Helper to sign HS256 JWT (useful for testing/verification scripts)
export function signHS256JWT(payload: any, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const signatureB64 = hmac.digest("base64url");
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. If in development, bypass authentication
  if (env.NODE_ENV === "development") {
    logger.info("🔑 Development environment: bypassing admin authentication check.");
    return next();
  }

  // 2. Otherwise, require Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Unauthorized Error",
      error: "Missing or invalid Authorization header. A 'Bearer <token>' is required in production.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyHS256JWT(token, env.JWT_SECRET);
    
    // Check if the token payload identifies an admin
    const isAdmin = decoded && (
      decoded.role === "admin" || 
      decoded.isAdmin === true || 
      decoded.user === "admin"
    );

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: "Forbidden Error",
        error: "Access denied. Admin role required.",
      });
      return;
    }

    // Attach decoded user info to request
    (req as any).user = decoded;
    next();
  } catch (error: any) {
    logger.warn(`❌ Admin authorization failed: ${error.message}`);
    res.status(401).json({
      success: false,
      message: "Unauthorized Error",
      error: "Invalid or expired token.",
    });
  }
}
