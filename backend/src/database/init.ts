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
        is_active INTEGER DEFAULT 1,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Alter products to add is_active column if missing (migration)
    try {
      db.exec("ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;");
      console.log("✈️ Added is_active column to products table.");
    } catch (e) {
      // Ignore if column already exists
    }

    // Alter products to add image_url column if missing (migration)
    try {
      db.exec("ALTER TABLE products ADD COLUMN image_url TEXT;");
      console.log("✈️ Added image_url column to products table.");
    } catch (e) {
      // Ignore if column already exists
    }

    // Create customers table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        address TEXT,
        notes TEXT,
        total_orders INTEGER DEFAULT 0,
        lifetime_value INTEGER DEFAULT 0,
        last_visit DATETIME,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Alter customers to add is_active column if missing (migration)
    try {
      db.exec("ALTER TABLE customers ADD COLUMN is_active INTEGER DEFAULT 1;");
      console.log("✈️ Added is_active column to customers table.");
    } catch (e) {
      // Ignore if column already exists
    }

    // Create sales table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        customer_id INTEGER,
        cashier_name TEXT,
        payment_method TEXT NOT NULL,
        subtotal INTEGER NOT NULL,
        discount INTEGER DEFAULT 0,
        gst INTEGER DEFAULT 0,
        grand_total INTEGER NOT NULL,
        public_token TEXT UNIQUE,
        pdf_url TEXT,
        shared_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Run schema alterations/migrations for older databases safely
    try {
      db.exec("ALTER TABLE sales ADD COLUMN public_token TEXT");
      console.log("📝 Added public_token column to sales table.");
    } catch (e) {
      // Column might already exist, which is fine
    }

    try {
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_public_token ON sales(public_token)");
      console.log("📝 Created unique index on public_token.");
    } catch (e) {
      console.error("⚠️ Failed to create unique index on public_token:", e);
    }

    try {
      db.exec("ALTER TABLE sales ADD COLUMN pdf_url TEXT");
      console.log("📝 Added pdf_url column to sales table.");
    } catch (e) { }

    try {
      db.exec("ALTER TABLE sales ADD COLUMN shared_at DATETIME");
      console.log("📝 Added shared_at column to sales table.");
    } catch (e) { }

    // Backfill public tokens for older sales records
    const stmtNullTokens = db.prepare("SELECT id FROM sales WHERE public_token IS NULL");
    const nullTokenSales = stmtNullTokens.all() as { id: number }[];
    if (nullTokenSales.length > 0) {
      console.log(`🔑 Generating base64url secure tokens for ${nullTokenSales.length} existing sales...`);
      const updateToken = db.prepare("UPDATE sales SET public_token = ? WHERE id = ?");
      const crypto = require("crypto");
      for (const sale of nullTokenSales) {
        const token = crypto.randomBytes(9).toString("base64url").substring(0, 12);
        updateToken.run(token, sale.id);
      }
    }

    // Initialize invoices storage directories
    const fs = require("fs");
    const path = require("path");
    const uploadsDir = path.join(__dirname, "../../uploads/invoices");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Create sale_items table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        selling_price INTEGER NOT NULL,
        discount INTEGER DEFAULT 0,
        line_total INTEGER NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // Create sync_jobs table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_attempt DATETIME
      );
    `);

    // Create settings table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Seed settings if empty
    const checkSettings = db.prepare("SELECT COUNT(*) as count FROM settings");
    const { count: settingsCount } = checkSettings.get() as { count: number };
    if (settingsCount === 0) {
      console.log("🌱 Seeding default shop settings...");
      const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
      insertSetting.run("shop_name", "Orion Store");
      insertSetting.run("shop_gstin", "27AAAAA1111A1Z1");
      insertSetting.run("shop_phone", "8285068670");
      insertSetting.run("shop_address", "123, POS Center, Sector V, Salt Lake, Kolkata, 700091");
      insertSetting.run("shop_upi_id", "orion@upi");
      insertSetting.run("whatsapp_footer", "Thank you for shopping. Visit Again.");
      insertSetting.run("signature", "Authorized Signatory");
      insertSetting.run("exchange_policy", "Items can be exchanged within 7 days with original receipt and tags intact.");
      insertSetting.run("invoice_theme", "classic");
      insertSetting.run("business_website", "https://orionpos.in");
      insertSetting.run("instagram_url", "https://instagram.com/orionpos");
      insertSetting.run("maps_url", "https://maps.google.com");
      insertSetting.run("google_sheet_id", "");
      insertSetting.run("google_sync_enabled", "0");
      insertSetting.run("pdf_retention_period", "90 Days");
      insertSetting.run("pdf_last_cleanup", "Never");
      insertSetting.run("logo", "");
    } else {
      // Ensure Google Sheets and PDF storage keys exist on existing databases
      try {
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('google_sheet_id', '')").run();
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('google_sync_enabled', '0')").run();
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('pdf_retention_period', '90 Days')").run();
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('pdf_last_cleanup', 'Never')").run();
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('logo', '')").run();
      } catch (e) {}
    }

    // Seed customers if empty
    const checkCustomers = db.prepare("SELECT COUNT(*) as count FROM customers");
    const { count } = checkCustomers.get() as { count: number };

    if (count === 0) {
      console.log("🌱 Seeding initial customer records...");
      const seedStmt = db.prepare(`
        INSERT INTO customers (
          name, phone, email, address, notes, total_orders, lifetime_value, last_visit
        ) VALUES (
          @name, @phone, @email, @address, @notes, @total_orders, @lifetime_value, @last_visit
        )
      `);

      const initialCustomers = [
        {
          name: "Rahul Sharma",
          phone: "8285068670",
          email: "rahul@example.com",
          address: "Delhi",
          notes: "Regular customer, prefers weekend visits",
          total_orders: 5,
          lifetime_value: 1200000, // 12,000.00 Rs in paise
          last_visit: "2026-07-01 10:30:00"
        },
        {
          name: "Priya Verma",
          phone: "9811122233",
          email: "priya@example.com",
          address: "Mumbai",
          notes: "VIP customer, high value, interested in boutique fashion",
          total_orders: 12,
          lifetime_value: 3500000, // 35,000.00 Rs in paise
          last_visit: "2026-07-05 14:15:00"
        },
        {
          name: "Ankit Singh",
          phone: "9899988877",
          email: "ankit@example.com",
          address: "Bangalore",
          notes: "Prefers online billing updates",
          total_orders: 3,
          lifetime_value: 800000,
          last_visit: "2026-06-28 18:45:00"
        },
        {
          name: "Amit Patel",
          phone: "9876543211",
          email: "amit@example.com",
          address: "Ahmedabad",
          notes: null,
          total_orders: 8,
          lifetime_value: 2400000,
          last_visit: "2026-07-02 11:00:00"
        },
        {
          name: "Sunita Rao",
          phone: "9876543212",
          email: "sunita@example.com",
          address: "Chennai",
          notes: "Always asks for digital invoices",
          total_orders: 20,
          lifetime_value: 7500000,
          last_visit: "2026-07-08 16:30:00"
        },
        {
          name: "Vikram Malhotra",
          phone: "9876543213",
          email: "vikram@example.com",
          address: "Kolkata",
          notes: "Walked in, did not purchase anything yet",
          total_orders: 0,
          lifetime_value: 0,
          last_visit: null
        },
        {
          name: "Neha Gupta",
          phone: "9876543214",
          email: "neha@example.com",
          address: "Jaipur",
          notes: "Referred by Priya Verma",
          total_orders: 2,
          lifetime_value: 450000,
          last_visit: "2026-05-15 12:00:00"
        },
        {
          name: "Rohan Das",
          phone: "9876543215",
          email: "rohan@example.com",
          address: "Pune",
          notes: "Enquired about custom bulk ordering",
          total_orders: 15,
          lifetime_value: 4800000,
          last_visit: "2026-07-07 09:15:00"
        },
        {
          name: "Kavita Nair",
          phone: "9876543216",
          email: "kavita@example.com",
          address: "Kochi",
          notes: "Prefers home delivery",
          total_orders: 7,
          lifetime_value: 1950000,
          last_visit: "2026-06-30 17:00:00"
        },
        {
          name: "Manish Joshi",
          phone: "9876543217",
          email: "manish@example.com",
          address: "Indore",
          notes: null,
          total_orders: 1,
          lifetime_value: 250000,
          last_visit: "2026-07-09 13:00:00"
        }
      ];

      const insertMany = db.transaction((customersList) => {
        for (const customer of customersList) {
          seedStmt.run(customer);
        }
      });
      insertMany(initialCustomers);
    }

    // Create query optimization indexes
    console.log("⚡ Creating database search and query indexes...");
    db.exec("CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);");
    console.log("✅ Database indexes verified/created successfully.");

    console.log("✅ Database tables checked/created successfully.");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
}
