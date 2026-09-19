import rateLimit from "express-rate-limit";
import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";
import type { Request, Response } from "express";
import { logger } from "../logger/logger";

/**
 * In-memory store that expires entries lazily instead of on a timer.
 *
 * express-rate-limit's bundled MemoryStore calls setInterval() from its init(), which
 * Cloudflare Workers rejects ("Disallowed operation called within global scope") because
 * the limiters are constructed while the module is evaluated. The library swallows that
 * failure, so requests still served, but the store logged an error on every cold start
 * and its expiry sweep never ran.
 *
 * Each key carries its own window expiry and is refreshed on read, so no timer is
 * needed. Entries for idle keys are reclaimed by a bounded sweep on write.
 *
 * NOTE: this is per-isolate, exactly like the store it replaces — Workers may run many
 * isolates, so the effective limit is per isolate rather than global. See the
 * Cloudflare-native follow-up noted in the module docs below.
 */
const MAX_TRACKED_KEYS = 10_000;

class LazyExpiryMemoryStore implements Store {
  localKeys = true;
  private windowMs = 60_000;
  private hits = new Map<string, { count: number; resetTime: number }>();

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private currentWindow(key: string): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.hits.get(key);
    if (existing && existing.resetTime > now) return existing;

    const fresh = { count: 0, resetTime: now + this.windowMs };
    this.hits.set(key, fresh);
    return fresh;
  }

  /** Drops expired keys; only runs when the map grows past the cap, so it stays O(1) amortised. */
  private sweepIfCrowded(): void {
    if (this.hits.size <= MAX_TRACKED_KEYS) return;
    const now = Date.now();
    for (const [key, entry] of this.hits) {
      if (entry.resetTime <= now) this.hits.delete(key);
    }
  }

  increment(key: string): ClientRateLimitInfo {
    this.sweepIfCrowded();
    const entry = this.currentWindow(key);
    entry.count += 1;
    return { totalHits: entry.count, resetTime: new Date(entry.resetTime) };
  }

  decrement(key: string): void {
    const entry = this.hits.get(key);
    if (entry && entry.count > 0) entry.count -= 1;
  }

  get(key: string): ClientRateLimitInfo | undefined {
    const entry = this.hits.get(key);
    if (!entry || entry.resetTime <= Date.now()) return undefined;
    return { totalHits: entry.count, resetTime: new Date(entry.resetTime) };
  }

  resetKey(key: string): void {
    this.hits.delete(key);
  }

  resetAll(): void {
    this.hits.clear();
  }
}

// Cloudflare Workers has no TCP socket, so `req.socket` is undefined and `req.ip`
// resolves to undefined. Derive the client IP from edge headers instead — reading
// `req.socket.remoteAddress` unguarded throws and fails every request.
function getClientIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) return cfIp.trim();

  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof forwardedValue === "string" && forwardedValue.trim()) {
    return forwardedValue.split(",")[0].trim();
  }

  return req.ip || (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress || "127.0.0.1";
}

/*
 * FOLLOW-UP (not done here — needs infrastructure config, not code):
 * Both limiters below count hits per Worker isolate. Cloudflare may run many isolates
 * concurrently, so the effective ceiling is higher than the configured `max` and resets
 * whenever an isolate is recycled. That is adequate as a safety valve but is not a
 * strict guarantee. For enforceable global limits, move to Cloudflare's native
 * Rate Limiting rules (dashboard/WAF) or a `[[unsafe.bindings]]` rate-limiter binding
 * in wrangler.toml, then this middleware can be reduced to a local backstop.
 */

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
  store: new LazyExpiryMemoryStore(),
  keyGenerator: getClientIp,
  handler: (req: Request, res: Response, _next, options) => {
    logger.warn(`⚠️ [RateLimit 429] Auth limiter triggered | Route: ${req.method} ${req.originalUrl || req.baseUrl} | IP: ${getClientIp(req)}`);
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
  store: new LazyExpiryMemoryStore(),
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
    return getClientIp(req);
  },
  skip: (req: Request): boolean => {
    // Skip health checks, root ping, static assets, and public token invoice views
    const p = req.originalUrl || req.path || "";
    if (
      p === "/health" ||
      p.startsWith("/health/") ||
      p === "/healthz" ||
      p === "/api/health" ||
      p.startsWith("/api/health/") ||
      p === "/ready" ||
      p === "/live" ||
      p === "/" ||
      p === "/favicon.ico" ||
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
    logger.warn(`⚠️ [RateLimit 429] API limiter triggered | Route: ${req.method} ${req.originalUrl || req.baseUrl} | AuthUser: ${isAuth ? "Authenticated" : "Anonymous"} | IP: ${getClientIp(req)}`);
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
