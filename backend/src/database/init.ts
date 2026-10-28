import { db } from "../db";
import { stores, users, settings, customers } from "../db/schema";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { count, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { env } from "../config/env";
import { logger } from "../logger/logger";
import { customerRepository } from "../repositories";
import { DatabaseProvider } from "./provider";
import { runZeroAvgCostMigration } from "../db/migrations/fix_zero_avg_cost_migration";

function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(__dirname, "../db/migrations"),
    path.join(__dirname, "../../src/db/migrations"),
    path.join(__dirname, "../../backend/src/db/migrations"),
    path.join(process.cwd(), "backend/src/db/migrations"),
    path.join(process.cwd(), "src/db/migrations"),
    path.join(process.cwd(), "backend/dist/db/migrations"),
    path.join(process.cwd(), "dist/db/migrations"),
  ];

  for (const candidate of candidates) {
    const journalPath = path.join(candidate, "meta", "_journal.json");
    if (fs.existsSync(journalPath)) {
      logger.info(`📍 Found Drizzle migrations at: ${candidate}`);
      return candidate;
    }
  }

  logger.warn(`⚠️ Could not find meta/_journal.json in candidates. Using fallback: ${path.join(process.cwd(), "src/db/migrations")}`);
  return path.join(process.cwd(), "src/db/migrations");
}

export async function initDb(): Promise<void> {
  try {
    console.log("Loading database...");
    console.log("Connecting PostgreSQL...");
    // 1. Verify connection first
    const isConnected = await DatabaseProvider.verifyConnection();
    if (!isConnected) {
      if (env.NODE_ENV === "production") {
        throw new Error("Production database is unreachable. Aborting startup to prevent unsafe offline state.");
      }
      logger.info("⚠️ Skipping database migrations & seeding (PostgreSQL unreachable / offline mode).");
      return;
    }

    logger.info("⏳ Running database migrations...");

    // 2. Programmatically apply Drizzle migrations
    const migrationsFolder = resolveMigrationsFolder();
    await migrate(db, { migrationsFolder });
    
    // 2b. Ensure sync_jobs organization_id and google_integrations table exist safely
    try {
      await db.execute(sql`ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS organization_id integer REFERENCES organizations(id)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS google_integrations (
          id SERIAL PRIMARY KEY,
          organization_id INTEGER NOT NULL REFERENCES organizations(id),
          store_id INTEGER REFERENCES stores(id),
          google_user_id TEXT,
          google_email TEXT,
          refresh_token TEXT NOT NULL,
          spreadsheet_id TEXT,
          spreadsheet_name TEXT,
          connected_at TIMESTAMP DEFAULT NOW() NOT NULL,
          last_sync TIMESTAMP,
          sync_enabled INTEGER DEFAULT 1 NOT NULL,
          sync_method TEXT DEFAULT 'oauth' NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_google_integrations_org_id ON google_integrations (organization_id);
        CREATE INDEX IF NOT EXISTS idx_google_integrations_store_id ON google_integrations (store_id);
      `);

      // 2c. Ensure KOT tables and product kitchen flag exist safely
      await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_kitchen_item integer DEFAULT 0 NOT NULL;`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_kitchen ON products (store_id, is_kitchen_item);`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS kots (
          id SERIAL PRIMARY KEY,
          organization_id INTEGER REFERENCES organizations(id),
          store_id INTEGER NOT NULL REFERENCES stores(id),
          sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
          kot_number INTEGER NOT NULL,
          status TEXT DEFAULT 'PENDING' NOT NULL,
          table_no TEXT,
          order_type TEXT DEFAULT 'DINE_IN' NOT NULL,
          notes TEXT,
          printed_at TIMESTAMP,
          reprint_count INTEGER DEFAULT 0 NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_kots_organization_id ON kots (organization_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_kots_store_kot_number ON kots (store_id, kot_number);
        CREATE INDEX IF NOT EXISTS idx_kots_sale_id ON kots (sale_id);
        CREATE INDEX IF NOT EXISTS idx_kots_store_status ON kots (store_id, status);
        CREATE INDEX IF NOT EXISTS idx_kots_store_created ON kots (store_id, created_at);

        CREATE TABLE IF NOT EXISTS kot_items (
          id SERIAL PRIMARY KEY,
          organization_id INTEGER REFERENCES organizations(id),
          store_id INTEGER REFERENCES stores(id),
          kot_id INTEGER NOT NULL REFERENCES kots(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id),
          quantity INTEGER NOT NULL,
          product_name_snapshot TEXT NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_kot_items_organization_id ON kot_items (organization_id);
        CREATE INDEX IF NOT EXISTS idx_kot_items_store_id ON kot_items (store_id);
        CREATE INDEX IF NOT EXISTS idx_kot_items_kot_id ON kot_items (kot_id);
        CREATE INDEX IF NOT EXISTS idx_kot_items_product_id ON kot_items (product_id);

        CREATE TABLE IF NOT EXISTS store_kot_sequences (
          id SERIAL PRIMARY KEY,
          store_id INTEGER NOT NULL REFERENCES stores(id),
          last_kot_number INTEGER DEFAULT 0 NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_store_kot_sequences_store_id ON store_kot_sequences (store_id);
      `);
    } catch (colErr) {
      logger.warn("Table/column migration notice for schema additions: " + String(colErr));
    }

    logger.info("✅ Drizzle migrations applied successfully.");

    // 3. Ensure a default store exists
    const storeCountResult = await db.select({ value: count() }).from(stores);
    const storeCount = storeCountResult[0]?.value || 0;
    if (storeCount === 0) {
      logger.info("🌱 Seeding default store...");
      await db.insert(stores).values({
        id: 1,
        name: "Apka Bill Store",
        address: "123, POS Center, Sector V, Salt Lake, Kolkata, 700091",
        phone: "8285068670",
        gst_number: "27AAAAA1111A1Z1",
        currency: "INR",
        timezone: "Asia/Kolkata",
      });
      logger.info("✅ Default store seeded successfully.");
    }

    // 4. Ensure a default admin user exists
    const userCountResult = await db.select({ value: count() }).from(users);
    const userCount = userCountResult[0]?.value || 0;
    if (userCount === 0) {
      logger.info(`🌱 Seeding default admin user (${env.ADMIN_EMAIL})...`);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, salt);

      await db.insert(users).values({
        id: 1,
        name: "Default Admin",
        email: env.ADMIN_EMAIL,
        phone: "8285068670",
        password_hash: passwordHash,
        role: "admin",
        store_id: 1,
        is_active: 1,
      });
      logger.info("✅ Default admin user seeded successfully.");
    }

    // 5. Seed default shop settings if empty for store_id = 1
    const settingsCountResult = await db.select({ value: count() }).from(settings).where(eq(settings.store_id, 1));
    const settingsCount = settingsCountResult[0]?.value || 0;
    if (settingsCount === 0) {
      logger.info("🌱 Seeding default settings for default store...");
      const seedSettings = [
        ["shop_name", "Apka Bill Store"],
        ["shop_gstin", "27AAAAA1111A1Z1"],
        ["shop_phone", "8285068670"],
        ["shop_address", "123, POS Center, Sector V, Salt Lake, Kolkata, 700091"],
        ["shop_upi_id", ""],
        ["whatsapp_footer", "Thank you for shopping. Visit Again."],
        ["signature", "Authorized Signatory"],
        ["exchange_policy", "Items can be exchanged within 7 days with original receipt and tags intact."],
        ["invoice_theme", "classic"],
        ["business_website", "https://apkabill.in"],
        ["instagram_url", "https://instagram.com/apkabill"],
        ["maps_url", "https://maps.google.com"],
        ["google_sheet_id", ""],
        ["google_sync_enabled", "0"],
        ["pdf_retention_period", "90 Days"],
        ["pdf_last_cleanup", "Never"],
        ["logo", ""],
        ["require_customer_before_checkout", "0"],
        ["receipt_template", "Classic"],
        ["qr_position", "Bottom"]
      ];

      for (const [key, val] of seedSettings) {
        await db.insert(settings).values({
          store_id: 1,
          key,
          value: val,
        });
      }
      logger.info("✅ Default settings seeded successfully.");
    }

    // 6. Seed initial customers if empty for store_id = 1
    const customersCountResult = await db.select({ value: count() }).from(customers).where(eq(customers.store_id, 1));
    const customersCount = customersCountResult[0]?.value || 0;
    if (customersCount === 0) {
      logger.info("🌱 Seeding default customers for default store...");
      const initialCustomers = [
        {
          store_id: 1,
          name: "Rahul Sharma",
          phone: "8285068670",
          email: "rahul@example.com",
          address: "Delhi",
          notes: "Regular customer, prefers weekend visits",
          total_orders: 5,
          lifetime_value: 1200000,
          last_visit: new Date("2026-07-01 10:30:00")
        },
        {
          store_id: 1,
          name: "Priya Verma",
          phone: "9811122233",
          email: "priya@example.com",
          address: "Mumbai",
          notes: "VIP customer, high value, interested in boutique fashion",
          total_orders: 12,
          lifetime_value: 3500000,
          last_visit: new Date("2026-07-05 14:15:00")
        },
        {
          store_id: 1,
          name: "Ankit Singh",
          phone: "9899988877",
          email: "ankit@example.com",
          address: "Bangalore",
          notes: "Prefers online billing updates",
          total_orders: 3,
          lifetime_value: 800000,
          last_visit: new Date("2026-06-28 18:45:00")
        }
      ];

      for (const cust of initialCustomers) {
        await db.insert(customers).values(cust);
      }
      logger.info("✅ Default customers seeded successfully.");
    }

    // Always ensure System Walk-in Customer exists for default store
    await customerRepository.ensureSystemWalkInCustomer(1, 1);
    logger.info("✅ System Walk-in Customer verified.");

    // 7. Ensure invoices uploads directory exists
    const uploadsDir = path.join(process.cwd(), "uploads/invoices");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 8. Run one-time zero average cost data repair migration
    await runZeroAvgCostMigration();

    logger.info("✅ PostgreSQL database initialization completed successfully.");
  } catch (error: any) {
    const pgErrorDetails: Record<string, any> = {};
    if (error) {
      pgErrorDetails.message = error.message;
      pgErrorDetails.stack = error.stack;
      if (error.code) pgErrorDetails.code = error.code;
      if (error.detail) pgErrorDetails.detail = error.detail;
      if (error.hint) pgErrorDetails.hint = error.hint;
      if (error.position) pgErrorDetails.position = error.position;
      if (error.where) pgErrorDetails.where = error.where;
      if (error.query) pgErrorDetails.query = error.query;
    }

    logger.error("❌ Database initialization failed with detailed error properties:", error, pgErrorDetails);

    console.error("❌ Database initialization failed with detailed error properties:");
    console.error(`Message: ${error?.message}`);
    console.error(`Code: ${error?.code}`);
    console.error(`Detail: ${error?.detail}`);
    console.error(`Hint: ${error?.hint}`);
    console.error(`Position: ${error?.position}`);
    console.error(`Where: ${error?.where}`);
    console.error(`Query: ${error?.query}`);
    console.error(`Stack: ${error?.stack}`);

    process.exit(1);
  }
}
