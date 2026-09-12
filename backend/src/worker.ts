if (typeof (globalThis as any).__dirname === "undefined") {
  (globalThis as any).__dirname = "/";
}
if (typeof (globalThis as any).__filename === "undefined") {
  (globalThis as any).__filename = "/worker.js";
}

import http from "node:http";
import { httpServerHandler } from "cloudflare:node";

import { app } from "./app";
import { getPool, detachPool } from "./db";

export interface Env {
  HYPERDRIVE?: {
    connectionString: string;
  };
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  NODE_ENV?: string;
  ALLOWED_ORIGINS?: string;
  PORT?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  [key: string]: any;
}

// Run Express through the runtime's real Node HTTP server rather than translating
// requests by hand. The previous serverless-http bridge relied on Node internals
// (assignSocket/_flush writing through a fake socket) that workerd's node:http shim
// does not implement, so request bodies never reached Express and every response
// body was dropped.
const PORT = 8080;
const server = http.createServer(app);
server.listen(PORT);

const nodeHandler = httpServerHandler({ port: PORT }) as {
  fetch: (request: Request, env: Env, ctx: any) => Promise<Response>;
};

export default {
  async fetch(request: Request, env: Env, ctx?: any): Promise<Response> {
    // Populate environment bindings into process.env for Node compatibility
    if (env.HYPERDRIVE?.connectionString) {
      process.env.HYPERDRIVE_URL = env.HYPERDRIVE.connectionString;
      process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
    } else if (env.DATABASE_URL) {
      process.env.DATABASE_URL = env.DATABASE_URL;
    }

    if (env.JWT_SECRET) process.env.JWT_SECRET = env.JWT_SECRET;
    if (env.ALLOWED_ORIGINS) process.env.ALLOWED_ORIGINS = env.ALLOWED_ORIGINS;
    if (env.CLOUDINARY_CLOUD_NAME) process.env.CLOUDINARY_CLOUD_NAME = env.CLOUDINARY_CLOUD_NAME;
    if (env.CLOUDINARY_API_KEY) process.env.CLOUDINARY_API_KEY = env.CLOUDINARY_API_KEY;
    if (env.CLOUDINARY_API_SECRET) process.env.CLOUDINARY_API_SECRET = env.CLOUDINARY_API_SECRET;

    // Sockets do not survive across requests on Workers, so start every request with a
    // fresh pool and close the previous one in the background.
    const stalePool = detachPool();
    if (stalePool) {
      const closing = stalePool.end().catch(() => {});
      if (typeof ctx?.waitUntil === "function") ctx.waitUntil(closing);
    }

    const url = new URL(request.url);

    // Fast-path immediate health check without DB overhead
    if (url.pathname === "/health" || url.pathname === "/health/live") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "orion-pos-api",
          runtime: "cloudflare-workers",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Dedicated /health/db probe verifying Neon Hyperdrive connectivity
    if (url.pathname === "/health/db") {
      try {
        const pool = getPool();
        await pool.query("SELECT 1 as connected");
        return new Response(
          JSON.stringify({
            status: "ok",
            database: "connected",
            provider: "postgresql",
            hyperdrive: true,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            status: "error",
            database: "disconnected",
            error: err?.message || String(err),
            timestamp: new Date().toISOString(),
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    try {
      return await nodeHandler.fetch(request, env, ctx);
    } catch (err: any) {
      console.error("Worker fetch execution error:", err);
      return new Response(
        JSON.stringify({
          error: err?.message || "Internal Server Error",
          status: 500,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
