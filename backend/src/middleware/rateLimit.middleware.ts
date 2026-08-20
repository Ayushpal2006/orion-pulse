import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { logger } from "../logger/logger";

/**
 * 1. Auth Rate Limiter (Brute-force protection)
 * Protects login, registration, and password operations.
 * Allows 30 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 30, // 30 attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  handler: (req: Request, res: Response, _next, options) => {
    logger.warn(`⚠️ [RateLimit 429] Auth limiter triggered | Route: ${req.method} ${req.originalUrl || req.baseUrl} | IP: ${req.ip}`);
    res.status(options.statusCode || 429).json(options.message);
  },
  message: {
    success: false,
    message: "Too many authentication attempts from this IP. Please try again after 15 minutes.",
    errorCode: "TOO_MANY_AUTH_ATTEMPTS",
  },
});

/**
 * 2. Normal Authenticated & POS API Rate Limiter
 * Protects normal business endpoints (products, customers, billing, reports, etc.)
 * Allows 600 requests per 1-minute window (10 req/s sustained).
 * Uses authenticated Bearer token (when present) as rate limit key to prevent
 * NAT / shared-IP store environments from blocking all cashiers.
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 600, // 600 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request): string => {
    // If request contains a Bearer authorization token, key by token prefix
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token.length >= 10) {
        return `auth_${token.slice(0, 32)}`;
      }
    }
    // Fall back to client IP for unauthenticated public traffic
    return req.ip || req.socket.remoteAddress || "127.0.0.1";
  },
  skip: (req: Request): boolean => {
    // Skip health checks, root ping, static assets, and public token invoice views
    const p = req.path || "";
    if (
      p === "/health" ||
      p === "/" ||
      p.startsWith("/uploads") ||
      p.startsWith("/storage") ||
      p.startsWith("/invoice/v/")
    ) {
      return true;
    }
    return false;
  },
  handler: (req: Request, res: Response, _next, options) => {
    const isAuth = Boolean(req.headers.authorization);
    logger.warn(`⚠️ [RateLimit 429] API limiter triggered | Route: ${req.method} ${req.originalUrl || req.baseUrl} | AuthUser: ${isAuth ? "Authenticated" : "Anonymous"} | IP: ${req.ip}`);
    res.status(options.statusCode || 429).json(options.message);
  },
  message: {
    success: false,
    message: "Rate limit exceeded for API operations. Please slow down your requests and try again shortly.",
    errorCode: "TOO_MANY_REQUESTS",
  },
});

// Alias for backwards compatibility
export const rateLimiter = apiLimiter;
