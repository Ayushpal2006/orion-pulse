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
  logger.warn("closeAndReopenDb is not supported for PostgreSQL active database.");
}

export * from "./database-adapter.interface";
