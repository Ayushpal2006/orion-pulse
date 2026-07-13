import Database from "better-sqlite3";
import { logger } from "../../logger/logger";
import path from "path";
import fs from "fs";

export function createSQLiteConnection(dbPath: string): Database.Database {
  // Resolve absolute path and ensure directories exist
  const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
  const dbDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  logger.info("SQLite connection initialized successfully");
  return db;
}
