import { db } from "../db";
import { stores, users, settings, customers } from "../db/schema";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { env } from "../config/env";
import { logger } from "../logger/logger";
import { DatabaseProvider } from "./provider";

export async function initDb(): Promise<void> {
  try {
    console.log("Loading database...");
    console.log("Connecting PostgreSQL...");
    // 1. Verify connection first
    await DatabaseProvider.verifyConnection();
    logger.info("⏳ Running database migrations...");

    // 2. Programmatically apply Drizzle migrations
    const migrationsFolder = path.join(process.cwd(), "src/db/migrations");
    await migrate(db, { migrationsFolder });
    logger.info("✅ Drizzle migrations applied successfully.");

    // 3. Ensure a default store exists
    const storeCountResult = await db.select({ value: count() }).from(stores);
    const storeCount = storeCountResult[0]?.value || 0;
    if (storeCount === 0) {
      logger.info("🌱 Seeding default store...");
      await db.insert(stores).values({
        id: 1,
        name: "Orion Store",
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
        ["shop_name", "Orion Store"],
        ["shop_gstin", "27AAAAA1111A1Z1"],
        ["shop_phone", "8285068670"],
        ["shop_address", "123, POS Center, Sector V, Salt Lake, Kolkata, 700091"],
        ["shop_upi_id", "orion@upi"],
        ["whatsapp_footer", "Thank you for shopping. Visit Again."],
        ["signature", "Authorized Signatory"],
        ["exchange_policy", "Items can be exchanged within 7 days with original receipt and tags intact."],
        ["invoice_theme", "classic"],
        ["business_website", "https://orionpos.in"],
        ["instagram_url", "https://instagram.com/orionpos"],
        ["maps_url", "https://maps.google.com"],
        ["google_sheet_id", ""],
        ["google_sync_enabled", "0"],
        ["pdf_retention_period", "90 Days"],
        ["pdf_last_cleanup", "Never"],
        ["logo", ""],
        ["require_customer_before_checkout", "0"]
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

    // 7. Ensure invoices uploads directory exists
    const uploadsDir = path.join(process.cwd(), "uploads/invoices");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Ensure storage/invoices/ directory exists
    const storageDir = path.join(process.cwd(), "storage/invoices");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    logger.info("✅ PostgreSQL database initialization completed successfully.");
  } catch (error) {
    logger.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
}
