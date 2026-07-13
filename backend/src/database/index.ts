import { DatabaseProvider } from "./provider";
import { DatabaseAdapter } from "./database-adapter.interface";
import { databaseConfig } from "../config/database";
import { logger } from "../logger/logger";

export { DatabaseProvider };

// Core database abstraction layer export
export const db: DatabaseAdapter = new Proxy({} as DatabaseAdapter, {
  get(target, prop, receiver) {
    const adapter = DatabaseProvider.getAdapter();
    const value = (adapter as any)[prop];
    if (typeof value === "function") {
      return value.bind(adapter);
    }
    return value;
  }
});

// Default export for backward compatibility with existing dbProxy imports
const dbProxy = db;
export default dbProxy;

export function closeAndReopenDb(): void {
  if (databaseConfig.type === "sqlite") {
    try {
      const activeAdapter = DatabaseProvider.getAdapter();
      if (activeAdapter) {
        activeAdapter.close();
      }
    } catch (e) {
      logger.error("Error closing database during reopen:", e);
    }
    DatabaseProvider.clearInstance();
    DatabaseProvider.getAdapter();
    logger.info("🔄 SQLite database connection re-established.");
  } else {
    logger.warn(`closeAndReopenDb is not supported for active database type: ${databaseConfig.type}`);
  }
}

export * from "./database-adapter.interface";
