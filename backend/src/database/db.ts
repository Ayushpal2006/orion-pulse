import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "database");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "orion.db");
let activeDb = new Database(dbPath);
activeDb.pragma("journal_mode = WAL");

export function closeAndReopenDb(): void {
  try {
    activeDb.close();
  } catch (e) {
    console.error("Error closing database during reopen:", e);
  }
  activeDb = new Database(dbPath);
  activeDb.pragma("journal_mode = WAL");
  console.log("🔄 SQLite database connection re-established.");
}

// Proxy wrapper to allow dynamic swapping of activeDb without breaking imports
const dbProxy = new Proxy({} as Database.Database, {
  get(target, prop, receiver) {
    const value = (activeDb as any)[prop];
    if (typeof value === "function") {
      return value.bind(activeDb);
    }
    return value;
  },
  set(target, prop, value) {
    (activeDb as any)[prop] = value;
    return true;
  }
});

export default dbProxy;