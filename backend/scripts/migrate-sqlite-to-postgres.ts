import Database from "better-sqlite3";
import { db } from "../src/db";
import { products, customers, sales, sale_items, settings, stores, users } from "../src/db/schema";
import path from "path";
import fs from "fs";

async function runMigration() {
  const sqliteDbPath = path.join(__dirname, "../database.db");
  if (!fs.existsSync(sqliteDbPath)) {
    console.log(`⚠️ SQLite database not found at "${sqliteDbPath}". Skipping migration.`);
    return;
  }

  console.log(`📦 Found SQLite database at "${sqliteDbPath}". Starting migration to PostgreSQL...`);
  const sqliteDb = new Database(sqliteDbPath);

  try {
    // 1. Ensure default store & admin user exist first
    const [store] = await db.insert(stores).values({
      id: 1,
      name: "Orion Store",
      address: "123, POS Center, Sector V, Salt Lake, Kolkata, 700091",
      phone: "8285068670",
      gst_number: "27AAAAA1111A1Z1",
    }).onConflictDoNothing().returning();

    // 2. Migrate settings
    console.log("⚙️ Migrating settings...");
    const sqliteSettings = sqliteDb.prepare("SELECT * FROM settings").all() as any[];
    for (const s of sqliteSettings) {
      await db.insert(settings).values({
        store_id: 1,
        key: s.key,
        value: s.value,
      }).onConflictDoNothing();
    }

    // 3. Migrate customers
    console.log("👥 Migrating customers...");
    const sqliteCustomers = sqliteDb.prepare("SELECT * FROM customers").all() as any[];
    const customerMap = new Map<number, number>(); // SQLite ID -> Postgres ID
    for (const c of sqliteCustomers) {
      const [inserted] = await db.insert(customers).values({
        store_id: 1,
        name: c.name,
        phone: c.phone,
        email: c.email ?? null,
        address: c.address ?? null,
        notes: c.notes ?? null,
        total_orders: c.total_orders ?? 0,
        lifetime_value: c.lifetime_value ?? 0,
        last_visit: c.last_visit ? new Date(c.last_visit) : null,
        is_active: c.is_active ?? 1,
      }).returning();
      customerMap.set(c.id, inserted.id);
    }

    // 4. Migrate products
    console.log("📦 Migrating products...");
    const sqliteProducts = sqliteDb.prepare("SELECT * FROM products").all() as any[];
    const productMap = new Map<number, number>(); // SQLite ID -> Postgres ID
    for (const p of sqliteProducts) {
      const [inserted] = await db.insert(products).values({
        store_id: 1,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode ?? null,
        category: p.category ?? null,
        purchase_price: p.purchase_price,
        selling_price: p.selling_price,
        stock: p.stock ?? 0,
        minimum_stock: p.minimum_stock ?? 0,
        gst: p.gst ?? 18,
        is_active: p.is_active ?? 1,
        image_url: p.image_url ?? null,
      }).returning();
      productMap.set(p.id, inserted.id);
    }

    // 5. Migrate sales & items
    console.log("💵 Migrating sales...");
    const sqliteSales = sqliteDb.prepare("SELECT * FROM sales").all() as any[];
    for (const s of sqliteSales) {
      const pgCustomerId = s.customer_id ? customerMap.get(s.customer_id) : null;
      const [insertedSale] = await db.insert(sales).values({
        store_id: 1,
        invoice_number: s.invoice_number,
        customer_id: pgCustomerId,
        cashier_name: s.cashier_name ?? "Admin",
        payment_method: s.payment_method,
        subtotal: s.subtotal,
        discount: s.discount ?? 0,
        gst: s.gst ?? 0,
        grand_total: s.grand_total,
        paid_amount: s.grand_total,
        balance: 0,
        public_token: s.public_token ?? null,
        pdf_url: s.pdf_url ?? null,
        shared_at: s.shared_at ? new Date(s.shared_at) : null,
        created_at: s.created_at ? new Date(s.created_at) : new Date(),
      }).returning();

      // Migrate items for this sale
      const sqliteItems = sqliteDb.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(s.id) as any[];
      for (const item of sqliteItems) {
        const pgProductId = productMap.get(item.product_id);
        if (pgProductId) {
          await db.insert(sale_items).values({
            sale_id: insertedSale.id,
            product_id: pgProductId,
            quantity: item.quantity,
            selling_price: item.selling_price,
            discount: item.discount ?? 0,
            line_total: item.line_total,
          });
        }
      }
    }

    console.log("🎉 Data migration from SQLite to PostgreSQL completed successfully!");
  } catch (error) {
    console.error("❌ Data migration failed:", error);
  } finally {
    sqliteDb.close();
  }
}

runMigration();
