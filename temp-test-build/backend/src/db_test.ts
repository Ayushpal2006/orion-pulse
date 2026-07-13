import Database from "better-sqlite3";
import path from "path";

console.log("1. Starting db check...");
const dbPath = path.join(__dirname, "../database/orion.db");
console.log("2. Database path:", dbPath);
try {
  const db = new Database(dbPath, { verbose: console.log });
  console.log("3. Database instantiated!");
  
  db.pragma("journal_mode = WAL");
  console.log("4. WAL pragma set!");
  
  const row = db.prepare("SELECT value FROM settings WHERE key = 'google_sync_enabled'").get();
  console.log("5. Query successful!", row);
} catch (e) {
  console.error("❌ DB Check failed:", e);
}
