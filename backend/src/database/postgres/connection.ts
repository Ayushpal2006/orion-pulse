import { Pool } from "pg";
import { logger } from "../../logger/logger";

let pgPool: Pool | null = null;
let currentConnStr: string | null = null;

export function createPostgresPool(connectionString: string): Pool {
  if (!pgPool || currentConnStr !== connectionString) {
    if (pgPool) {
      pgPool.end().catch(() => {});
    }
    currentConnStr = connectionString;
    pgPool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pgPool.on("error", (err) => {
      logger.error("Unexpected error on idle PostgreSQL client in pool", err);
    });

    logger.info("PostgreSQL connection pool initialized successfully");
  }
  return pgPool;
}

export function getActivePostgresPool(): Pool | null {
  return pgPool;
}
