import { Pool } from "pg";
import { logger } from "../../logger/logger";

let pgPool: Pool | null = null;

export function createPostgresPool(connectionString: string): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pgPool.on("error", (err) => {
      logger.error("Unexpected error on idle PostgreSQL client in pool", err);
    });

    logger.info("PostgreSQL connection pool initialized successfully");
  }
  return pgPool;
}
