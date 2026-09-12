import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env";
import * as schema from "./schema";

let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
let activeConnStr: string | null = null;

export function getDatabaseUrl(): string {
  return (
    process.env.HYPERDRIVE_URL ||
    process.env.DATABASE_URL ||
    env.DATABASE_URL ||
    ""
  );
}

export function getPool(): Pool {
  const connStr = getDatabaseUrl();
  if (!poolInstance || (activeConnStr !== connStr && connStr)) {
    if (poolInstance) {
      poolInstance.end().catch(() => {});
    }
    activeConnStr = connStr;
    poolInstance = new Pool({
      connectionString: connStr || undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    poolInstance.on("error", (err) => {
      console.error("💥 [PostgreSQL Pool Error] Unexpected idle client error:", err?.message || err);
    });
    dbInstance = drizzle(poolInstance, { schema });
  }
  return poolInstance;
}

export function getDb(): ReturnType<typeof drizzle> {
  getPool();
  return dbInstance!;
}

/**
 * Detaches the current pool so the next getPool() builds a fresh one, returning the
 * old pool for the caller to close.
 *
 * Only needed on Cloudflare Workers: a TCP socket cannot outlive the request that
 * opened it, so a pooled connection carried into the next request is already dead and
 * any query on it hangs until the runtime cancels the request.
 */
export function detachPool(): Pool | null {
  const previous = poolInstance;
  poolInstance = null;
  dbInstance = null;
  activeConnStr = null;
  return previous;
}

// Transparent Proxy wrappers for backward compatibility with `import { db, pool } from "./db"`
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const currentPool = getPool();
    const val = (currentPool as any)[prop];
    if (typeof val === "function") {
      return val.bind(currentPool);
    }
    return val;
  },
});

export const db: ReturnType<typeof drizzle> = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const currentDb = getDb();
    const val = (currentDb as any)[prop];
    if (typeof val === "function") {
      return val.bind(currentDb);
    }
    return val;
  },
});
