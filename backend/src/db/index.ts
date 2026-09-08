import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("💥 [PostgreSQL Pool Error] Unexpected idle client error:", err.message || err);
});

export const db = drizzle(pool, { schema });
