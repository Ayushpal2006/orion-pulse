import db from "./db";

export function initDb(): void {
  try {
    console.log("⏳ Initializing database...");
    
    // Create products table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        barcode TEXT UNIQUE,
        category TEXT,
        purchase_price INTEGER NOT NULL,
        selling_price INTEGER NOT NULL,
        stock INTEGER DEFAULT 0,
        minimum_stock INTEGER DEFAULT 0,
        gst INTEGER DEFAULT 18,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log("✅ Database tables checked/created successfully.");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
}
