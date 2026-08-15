/**
 * Apka Bill Mobile - Migration 003: Local-First Offline Billing Tables
 *
 * Defines tables for:
 * - sales: Local sale records (supports PENDING_SYNC tracking)
 * - sale_items: Items associated with each local sale
 * - payments: Payment records for each sale
 * - inventory_movements: Local inventory tracking log
 */

import { Migration, DatabaseExecutor } from '../types';

export const migration003: Migration = {
  id: 3,
  name: '003_local_billing',
  up: async (db: DatabaseExecutor): Promise<void> => {
    // 1. Sales Table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS sales (
        local_id TEXT PRIMARY KEY,
        server_id INTEGER,
        local_invoice_number TEXT NOT NULL UNIQUE,
        invoice_number TEXT,
        organization_id INTEGER,
        store_id INTEGER NOT NULL,
        customer_id INTEGER,
        customer_name TEXT,
        customer_phone TEXT,
        cashier_name TEXT,
        payment_method TEXT NOT NULL,
        payment_details TEXT,
        subtotal INTEGER NOT NULL,
        discount INTEGER DEFAULT 0 NOT NULL,
        gst INTEGER DEFAULT 0 NOT NULL,
        grand_total INTEGER NOT NULL,
        paid_amount INTEGER DEFAULT 0 NOT NULL,
        balance INTEGER DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'COMPLETED' NOT NULL,
        sync_status TEXT DEFAULT 'PENDING_SYNC' NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_sales_store_sync 
      ON sales(store_id, sync_status);
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_sales_created 
      ON sales(created_at);
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_sales_local_inv 
      ON sales(local_invoice_number);
    `);

    // 2. Sale Items Table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS sale_items (
        local_id TEXT PRIMARY KEY,
        sale_local_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        selling_price INTEGER NOT NULL,
        discount INTEGER DEFAULT 0 NOT NULL,
        gst INTEGER DEFAULT 18 NOT NULL,
        line_total INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (sale_local_id) REFERENCES sales(local_id) ON DELETE CASCADE
      );
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale 
      ON sale_items(sale_local_id);
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_sale_items_prod 
      ON sale_items(product_id);
    `);

    // 3. Payments Table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS payments (
        local_id TEXT PRIMARY KEY,
        sale_local_id TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reference TEXT,
        status TEXT DEFAULT 'COMPLETED' NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (sale_local_id) REFERENCES sales(local_id) ON DELETE CASCADE
      );
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_payments_sale 
      ON payments(sale_local_id);
    `);

    // 4. Inventory Movements Table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        local_id TEXT PRIMARY KEY,
        organization_id INTEGER,
        store_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        sale_local_id TEXT,
        movement_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        reference_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_inv_mov_store_prod 
      ON inventory_movements(store_id, product_id);
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_inv_mov_sale 
      ON inventory_movements(sale_local_id);
    `);
  },

  down: async (db: DatabaseExecutor): Promise<void> => {
    await db.executeSql('DROP TABLE IF EXISTS inventory_movements;');
    await db.executeSql('DROP TABLE IF EXISTS payments;');
    await db.executeSql('DROP TABLE IF EXISTS sale_items;');
    await db.executeSql('DROP TABLE IF EXISTS sales;');
  },
};

export default migration003;
