import path from "path";
import fs from "fs";
import { databaseConfig } from "../config/database";
import { DatabaseAdapter } from "./database-adapter.interface";
import { SQLiteAdapter } from "./sqlite/sqlite.adapter";
import { PostgresAdapter } from "./postgres/postgres.adapter";
import { logger } from "../utils/logger";

let activeAdapter: DatabaseAdapter;

function initializeAdapter(): DatabaseAdapter {
  if (databaseConfig.type === "postgres") {
    logger.info("🔌 Initializing PostgreSQL Adapter...");
    return new PostgresAdapter(databaseConfig.postgres.connectionString);
  } else {
    logger.info("🔌 Initializing SQLite Adapter...");
    const dbPath = databaseConfig.sqlite.filename;
    
    // Resolve absolute path and ensure directories exist
    const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
    const dbDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    return new SQLiteAdapter(resolvedPath);
  }
}

export function getDatabaseAdapter(): DatabaseAdapter {
  if (!activeAdapter) {
    activeAdapter = initializeAdapter();
  }
  return activeAdapter;
}

export function closeAndReopenDb(): void {
  if (databaseConfig.type === "sqlite") {
    try {
      if (activeAdapter) {
        // Cast to SQLiteAdapter to retrieve actual object
        (activeAdapter as SQLiteAdapter).close();
      }
    } catch (e) {
      logger.error("Error closing database during reopen:", e);
    }
    const dbPath = databaseConfig.sqlite.filename;
    const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
    activeAdapter = new SQLiteAdapter(resolvedPath);
    logger.info("🔄 SQLite database connection re-established.");
  } else {
    logger.warn(`closeAndReopenDb is not supported for active database type: ${databaseConfig.type}`);
  }
}

// Proxy wrapper to allow imports without lifecycle worries
const dbProxy = new Proxy({} as DatabaseAdapter, {
  get(target, prop, receiver) {
    const adapter = getDatabaseAdapter();
    const value = (adapter as any)[prop];
    if (typeof value === "function") {
      return value.bind(adapter);
    }
    return value;
  }
});

export default dbProxy;
export * from "./database-adapter.interface";
