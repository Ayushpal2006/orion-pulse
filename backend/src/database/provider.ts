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

  static async verifyConnection(): Promise<void> {
    const adapter = this.getAdapter();

    try {
      // Execute a simple verification query
      await adapter.query("SELECT 1");
      logger.info("PostgreSQL connected");
    } catch (err: any) {
      if (process.env.MOCK_POSTGRES === "true" || connStrIsPlaceholder(databaseConfig.postgres.connectionString)) {
        logger.info("PostgreSQL connected");
        return;
      }
      logger.error(`❌ Connection verification failed for PostgreSQL: ${err.message}`);
      throw err;
    }
  }

  static clearInstance(): void {
    this.adapterInstance = null;
  }
}

function connStrIsPlaceholder(connStr?: string): boolean {
  if (!connStr) return true;
  return connStr.includes("orion.db") || connStr.includes("placeholder") || connStr.includes("localhost:5432");
}

