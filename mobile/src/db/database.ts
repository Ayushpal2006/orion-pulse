/**
 * Apka Bill Mobile - SQLite Database Connection & Lifecycle Manager
 *
 * Responsibilities:
 * - Opens/manages native SQLite connection (apkabill.db)
 * - Configures performance pragmas (WAL mode, synchronous normal, foreign keys)
 * - Executes idempotent migrations on initialization
 * - Exposes typed query execution helpers
 * - Provides graceful fallback for headless / test environments
 */

import SQLite from 'react-native-sqlite-storage';
import { DatabaseExecutor } from './types';
import { runMigrations } from './migrations';

// Enable Promise-based API for react-native-sqlite-storage
if (typeof SQLite !== 'undefined' && SQLite.enablePromise) {
  SQLite.enablePromise(true);
}

const DATABASE_NAME = 'apkabill.db';
const DATABASE_LOCATION = 'default';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;
let isInitialized = false;

// Fallback in-memory store for Node / Jest / headless environments
interface MemoryTable {
  rows: Record<string, any>[];
}
const memoryDb: Record<string, MemoryTable> = {};

// Safe dynamic accessor for react-native-sqlite-storage
const getSQLite = () => {
  try {
    return require('react-native-sqlite-storage');
  } catch {
    return null;
  }
};

/**
 * Creates a DatabaseExecutor wrapping a native SQLite database instance
 */
function createExecutor(db: SQLite.SQLiteDatabase): DatabaseExecutor {
  const executor: DatabaseExecutor = {
    executeSql: async (sql: string, params: any[] = []): Promise<any> => {
      const [result] = await db.executeSql(sql, params);
      return result;
    },

    getAll: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
      const [result] = await db.executeSql(sql, params);
      const items: T[] = [];
      if (result && result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i));
        }
      }
      return items;
    },

    getFirst: async <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
      const [result] = await db.executeSql(sql, params);
      if (result && result.rows && result.rows.length > 0) {
        return result.rows.item(0);
      }
      return null;
    },

    transaction: async <T = void>(fn: (tx: DatabaseExecutor) => Promise<T>): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        db.transaction((tx) => {
          const txExecutor: DatabaseExecutor = {
            executeSql: (sql: string, params: any[] = []) => {
              return new Promise((res, rej) => {
                tx.executeSql(
                  sql,
                  params,
                  (_tx, result) => res(result),
                  (_tx, error) => {
                    rej(error);
                    return false;
                  }
                );
              });
            },
            getAll: (sql: string, params: any[] = []) => {
              return new Promise((res, rej) => {
                tx.executeSql(
                  sql,
                  params,
                  (_tx, result) => {
                    const items: any[] = [];
                    for (let i = 0; i < result.rows.length; i++) {
                      items.push(result.rows.item(i));
                    }
                    res(items);
                  },
                  (_tx, error) => {
                    rej(error);
                    return false;
                  }
                );
              });
            },
            getFirst: (sql: string, params: any[] = []) => {
              return new Promise((res, rej) => {
                tx.executeSql(
                  sql,
                  params,
                  (_tx, result) => {
                    if (result.rows.length > 0) {
                      res(result.rows.item(0));
                    } else {
                      res(null);
                    }
                  },
                  (_tx, error) => {
                    rej(error);
                    return false;
                  }
                );
              });
            },
            transaction: async (nestedFn) => nestedFn(txExecutor),
          };

          fn(txExecutor).then(resolve).catch(reject);
        });
      });
    },
  };

  return executor;
}

/**
 * Headless In-Memory Executor for Testing & Node Environments
 */
function createMemoryExecutor(): DatabaseExecutor {
  const parseTable = (sql: string): string => {
    const match = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i) ||
      sql.match(/INTO\s+([a-zA-Z0-9_]+)/i) ||
      sql.match(/TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i) ||
      sql.match(/UPDATE\s+([a-zA-Z0-9_]+)/i);
    return match ? match[1].toLowerCase() : 'unknown';
  };

  const getTable = (name: string): MemoryTable => {
    if (!memoryDb[name]) {
      memoryDb[name] = { rows: [] };
    }
    return memoryDb[name];
  };

  const executor: DatabaseExecutor = {
    executeSql: async (sql: string, params: any[] = []): Promise<any> => {
      const trimmed = sql.trim().toUpperCase();
      const tableName = parseTable(sql);
      const table = getTable(tableName);

      if (trimmed.startsWith('CREATE TABLE')) {
        getTable(tableName);
        return { rowsAffected: 0 };
      }

      if (trimmed.startsWith('CREATE INDEX')) {
        return { rowsAffected: 0 };
      }

      if (trimmed.startsWith('PRAGMA')) {
        return { rowsAffected: 0 };
      }

      if (trimmed.startsWith('INSERT INTO __MIGRATIONS') || trimmed.startsWith('INSERT OR REPLACE INTO __MIGRATIONS')) {
        const [id, name, applied_at] = params;
        const existingIdx = table.rows.findIndex((r) => r.id === id);
        if (existingIdx >= 0) {
          table.rows[existingIdx] = { id, name, applied_at };
        } else {
          table.rows.push({ id, name, applied_at });
        }
        return { rowsAffected: 1, insertId: id };
      }

      if (trimmed.startsWith('INSERT OR REPLACE INTO STORES') || trimmed.startsWith('INSERT INTO STORES')) {
        const [id, organization_id, name, code, address, city, state, country, gst_number, phone, currency, timezone, status, created_at, updated_at] = params;
        const existingIdx = table.rows.findIndex((r) => r.id === id);
        const record = { id, organization_id, name, code, address, city, state, country, gst_number, phone, currency, timezone, status, created_at, updated_at };
        if (existingIdx >= 0) {
          table.rows[existingIdx] = record;
        } else {
          table.rows.push(record);
        }
        return { rowsAffected: 1, insertId: id };
      }

      if (trimmed.startsWith('INSERT OR REPLACE INTO PRODUCTS') || trimmed.startsWith('INSERT INTO PRODUCTS')) {
        const [id, organization_id, store_id, name, sku, barcode, category, selling_price, purchase_price, stock, minimum_stock, gst, is_active, image_url, created_at, updated_at] = params;
        const existingIdx = table.rows.findIndex((r) => r.id === id);
        const record = { id, organization_id, store_id, name, sku, barcode, category, selling_price, purchase_price, stock, minimum_stock, gst, is_active, image_url, created_at, updated_at };
        if (existingIdx >= 0) {
          table.rows[existingIdx] = record;
        } else {
          table.rows.push(record);
        }
        return { rowsAffected: 1, insertId: id };
      }

      if (trimmed.startsWith('INSERT OR REPLACE INTO CUSTOMERS') || trimmed.startsWith('INSERT INTO CUSTOMERS')) {
        const [id, organization_id, store_id, name, phone, email, address, notes, total_orders, lifetime_value, is_active, created_at, updated_at] = params;
        const existingIdx = table.rows.findIndex((r) => r.id === id);
        const record = { id, organization_id, store_id, name, phone, email, address, notes, total_orders, lifetime_value, is_active, created_at, updated_at };
        if (existingIdx >= 0) {
          table.rows[existingIdx] = record;
        } else {
          table.rows.push(record);
        }
        return { rowsAffected: 1, insertId: id };
      }

      if (trimmed.startsWith('DELETE FROM')) {
        const count = table.rows.length;
        table.rows = [];
        return { rowsAffected: count };
      }

      return { rowsAffected: 0 };
    },

    getAll: async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
      const tableName = parseTable(sql);
      const table = getTable(tableName);
      const trimmed = sql.trim().toUpperCase();

      if (trimmed.includes('COUNT(*)')) {
        let count = table.rows.length;
        if (params.length > 0 && trimmed.includes('WHERE STORE_ID = ?')) {
          count = table.rows.filter((r) => r.store_id === params[0]).length;
        }
        return [{ count }] as any;
      }

      if (trimmed.includes('WHERE ID = ?')) {
        const id = params[0];
        return table.rows.filter((r) => r.id === id) as any;
      }

      if (trimmed.includes('WHERE STORE_ID = ? AND BARCODE = ?') || trimmed.includes('BARCODE = ?')) {
        const barcode = params[params.length - 1];
        return table.rows.filter((r) => r.barcode === barcode) as any;
      }

      if (trimmed.includes('WHERE STORE_ID = ? AND PHONE = ?') || trimmed.includes('PHONE = ?')) {
        const phone = params[params.length - 1];
        return table.rows.filter((r) => r.phone === phone) as any;
      }

      if (trimmed.includes('LIKE')) {
        // Search query
        const queryTerm = params.find((p) => typeof p === 'string' && p.startsWith('%')) || '';
        const cleanTerm = queryTerm.replace(/%/g, '').toLowerCase();
        return table.rows.filter((r) => {
          const nameMatch = r.name && String(r.name).toLowerCase().includes(cleanTerm);
          const skuMatch = r.sku && String(r.sku).toLowerCase().includes(cleanTerm);
          const barcodeMatch = r.barcode && String(r.barcode).toLowerCase().includes(cleanTerm);
          const phoneMatch = r.phone && String(r.phone).toLowerCase().includes(cleanTerm);
          return nameMatch || skuMatch || barcodeMatch || phoneMatch;
        }) as any;
      }

      if (params.length > 0 && trimmed.includes('WHERE STORE_ID = ?')) {
        const storeId = params[0];
        return table.rows.filter((r) => r.store_id === storeId) as any;
      }

      return [...table.rows] as any;
    },

    getFirst: async <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
      const rows = await executor.getAll<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },

    transaction: async <T = void>(fn: (tx: DatabaseExecutor) => Promise<T>): Promise<T> => {
      return fn(executor);
    },
  };

  return executor;
}

let activeExecutor: DatabaseExecutor | null = null;

/**
 * Initializes the SQLite database, configures pragmas, and executes pending migrations.
 * Guaranteed to be idempotent.
 */
export async function initDatabase(): Promise<DatabaseExecutor> {
  if (isInitialized && activeExecutor) {
    return activeExecutor;
  }

  if (isInitializing) {
    // Wait for in-flight initialization
    while (isInitializing) {
      await new Promise<void>((r) => setTimeout(() => r(), 50));
    }
    if (activeExecutor) return activeExecutor;
  }

  isInitializing = true;

  try {
    const SQLiteLib = getSQLite();
    let executor: DatabaseExecutor;

    if (SQLiteLib && SQLiteLib.openDatabase) {
      if (SQLiteLib.enablePromise) {
        SQLiteLib.enablePromise(true);
      }

      console.log(`[DB] Opening SQLite database "${DATABASE_NAME}"...`);
      const openedDb = await SQLiteLib.openDatabase({
        name: DATABASE_NAME,
        location: DATABASE_LOCATION,
      });
      dbInstance = openedDb;

      executor = createExecutor(openedDb);

      // Configure WAL performance pragmas
      await executor.executeSql('PRAGMA journal_mode = WAL;');
      await executor.executeSql('PRAGMA synchronous = NORMAL;');
      await executor.executeSql('PRAGMA foreign_keys = ON;');
      console.log('[DB] ✅ SQLite Pragmas configured (WAL mode, foreign keys ON).');
    } else {
      console.log('[DB] Native SQLite unavailable. Initializing in-memory fallback adapter...');
      executor = createMemoryExecutor();
    }

    // Run migrations
    const applied = await runMigrations(executor);
    console.log(`[DB] ✅ Database initialized successfully (${applied} new migrations).`);

    activeExecutor = executor;
    isInitialized = true;
    return activeExecutor;
  } catch (error) {
    console.error('[DB] ❌ Database initialization failed:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Retrieves the active database executor, automatically initializing if not yet done.
 */
export async function getDatabase(): Promise<DatabaseExecutor> {
  if (!activeExecutor || !isInitialized) {
    return initDatabase();
  }
  return activeExecutor;
}

/**
 * Closes the active database connection if open
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.close();
      console.log('[DB] Database closed.');
    } catch (err) {
      console.error('[DB] Error closing database:', err);
    }
  }
  dbInstance = null;
  activeExecutor = null;
  isInitialized = false;
}

export default {
  initDatabase,
  getDatabase,
  closeDatabase,
};
