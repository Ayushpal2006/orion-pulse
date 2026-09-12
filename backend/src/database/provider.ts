import { DatabaseAdapter } from "./database-adapter.interface";
import { PostgresAdapter } from "./postgres/postgres.adapter";
import { createPostgresPool } from "./postgres/connection";
import { databaseConfig } from "../config/database";
import { logger } from "../logger/logger";

export class DatabaseProvider {
  private static adapterInstance: DatabaseAdapter | null = null;

  static getAdapter(): DatabaseAdapter {
    if (this.adapterInstance) {
      return this.adapterInstance;
    }

    const connStr = databaseConfig.postgres.connectionString;
    if (!connStr) {
      throw new Error("PostgreSQL connection string is not configured in DATABASE_URL.");
    }
    const pool = createPostgresPool(connStr);
    this.adapterInstance = new PostgresAdapter(pool);

    return this.adapterInstance;
  }

  static async verifyConnection(): Promise<boolean> {
    const connStr = databaseConfig.postgres.connectionString;
    const isProd = process.env.NODE_ENV === "production";
    if (process.env.MOCK_POSTGRES === "true" || connStrIsPlaceholder(connStr)) {
      if (isProd) {
        throw new Error("Cannot run in Mock/Placeholder database mode in production environment.");
      }
      logger.info(`PostgreSQL connection skipped (Mock / Placeholder mode: ${connStr || "none"})`);
      return false;
    }

    const adapter = this.getAdapter();
    const maxRetries = isProd ? 15 : 5;
    const retryDelayMs = 2000;

    for (let i = 1; i <= maxRetries; i++) {
      try {
        logger.info(`[Attempt ${i}/${maxRetries}] Connecting PostgreSQL...`);
        await adapter.query("SELECT 1");
        logger.info("PostgreSQL connected");
        return true;
      } catch (err: any) {
        const isEnotfound = err?.code === "ENOTFOUND" || (err?.message && err.message.includes("ENOTFOUND"));
        if (isEnotfound && !isProd) {
          logger.info("PostgreSQL connection skipped (Unreachable DNS host in non-production)");
          return false;
        }
        
        logger.warn(`⚠️ PostgreSQL connection attempt ${i} failed: ${err.message}`);
        
        if (i === maxRetries) {
          logger.error(`❌ Connection verification failed for PostgreSQL after ${maxRetries} attempts: ${err.message}`);
          throw err;
        }
        
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
    return false;
  }

  static clearInstance(): void {
    this.adapterInstance = null;
  }
}

function connStrIsPlaceholder(connStr?: string): boolean {
  if (!connStr || connStr.trim() === "") return true;
  return (
    connStr.includes("placeholder") ||
    connStr.includes("your-database-url")
  );
}


