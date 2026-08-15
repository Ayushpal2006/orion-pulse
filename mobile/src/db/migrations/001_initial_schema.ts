/**
 * Apka Bill Mobile - Migration 001: Initial Local SQLite Schema
 *
 * Defines tables for stores, products, customers, and fast query indexes.
 * Completely idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
 */

import { Migration, DatabaseExecutor } from '../types';

export const migration001: Migration = {
  id: 1,
  name: '001_initial_schema',
  up: async (db: DatabaseExecutor): Promise<void> => {
    // 1. Stores table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER,
        name TEXT NOT NULL,
        code TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        gst_number TEXT,
        phone TEXT,
        currency TEXT DEFAULT 'INR',
        timezone TEXT DEFAULT 'Asia/Kolkata',
        status TEXT DEFAULT 'active',
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // 2. Products table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER,
        store_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        sku TEXT NOT NULL,
        barcode TEXT,
        category TEXT,
        selling_price INTEGER NOT NULL,
        purchase_price INTEGER DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        minimum_stock INTEGER DEFAULT 0,
        gst INTEGER DEFAULT 18,
        is_active INTEGER NOT NULL DEFAULT 1,
        image_url TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // Indexes for ultra-fast product lookup & search
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_products_store_active 
      ON products(store_id, is_active);
    `);
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_products_barcode 
      ON products(store_id, barcode);
    `);
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_products_sku 
      ON products(store_id, sku);
    `);
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_products_name 
      ON products(name);
    `);
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_products_category 
      ON products(category);
    `);

    // 3. Customers table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER,
        store_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        total_orders INTEGER DEFAULT 0,
        lifetime_value INTEGER DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // Indexes for fast customer lookup
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_customers_store_phone 
      ON customers(store_id, phone);
    `);
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_customers_name 
      ON customers(name);
    `);
  },

  down: async (db: DatabaseExecutor): Promise<void> => {
    await db.executeSql('DROP TABLE IF EXISTS customers;');
    await db.executeSql('DROP TABLE IF EXISTS products;');
    await db.executeSql('DROP TABLE IF EXISTS stores;');
  },
};

export default migration001;
