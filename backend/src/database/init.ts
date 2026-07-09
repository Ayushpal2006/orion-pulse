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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
          phone: "9876543210",
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
      console.log("🌱 Customer seeding complete.");
    }
    
    console.log("✅ Database tables checked/created successfully.");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
}
