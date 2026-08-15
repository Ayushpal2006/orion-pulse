/**
 * Apka Bill Mobile - Customer SQLite Repository
 *
 * Encapsulates all local customer storage, search, and batch persistence logic.
 */

import { getDatabase } from '../database';
import { LocalCustomer } from '../types';

export interface CustomerQueryOptions {
  storeId?: number;
  limit?: number;
  offset?: number;
}

export const CustomerRepository = {
  /**
   * Retrieves customers with optional store filtering and pagination
   */
  async getAll(options: CustomerQueryOptions = {}): Promise<LocalCustomer[]> {
    const db = await getDatabase();
    const { storeId, limit = 100, offset = 0 } = options;

    let sql = 'SELECT * FROM customers WHERE is_active = 1';
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }

    sql += ' ORDER BY name ASC LIMIT ? OFFSET ?;';
    params.push(limit, offset);

    return db.getAll<LocalCustomer>(sql, params);
  },

  /**
   * Finds a customer by primary server identifier
   */
  async getById(id: number): Promise<LocalCustomer | null> {
    const db = await getDatabase();
    return db.getFirst<LocalCustomer>('SELECT * FROM customers WHERE id = ? LIMIT 1;', [id]);
  },

  /**
   * Finds a customer by phone number
   */
  async getByPhone(phone: string, storeId?: number): Promise<LocalCustomer | null> {
    const db = await getDatabase();
    const cleanPhone = phone.trim();
    if (storeId !== undefined) {
      return db.getFirst<LocalCustomer>(
        'SELECT * FROM customers WHERE phone = ? AND store_id = ? AND is_active = 1 LIMIT 1;',
        [cleanPhone, storeId]
      );
    }
    return db.getFirst<LocalCustomer>(
      'SELECT * FROM customers WHERE phone = ? AND is_active = 1 LIMIT 1;',
      [cleanPhone]
    );
  },

  /**
   * Instant offline search by Customer Name or Phone Number
   */
  async search(query: string, storeId?: number, limit = 50): Promise<LocalCustomer[]> {
    const db = await getDatabase();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return this.getAll({ storeId, limit });
    }

    const searchParam = `%${cleanQuery}%`;
    let sql = `
      SELECT * FROM customers 
      WHERE is_active = 1 
        AND (name LIKE ? OR phone LIKE ?)
    `;
    const params: any[] = [searchParam, searchParam];

    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }

    sql += ' ORDER BY name ASC LIMIT ?;';
    params.push(limit);

    return db.getAll<LocalCustomer>(sql, params);
  },

  /**
   * Upserts a single customer (INSERT OR REPLACE)
   */
  async upsert(customer: LocalCustomer): Promise<void> {
    const db = await getDatabase();
    const sql = `
      INSERT OR REPLACE INTO customers (
        id, organization_id, store_id, name, phone,
        email, address, notes, total_orders, lifetime_value,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await db.executeSql(sql, [
      customer.id,
      customer.organization_id || null,
      customer.store_id,
      customer.name,
      customer.phone || null,
      customer.email || null,
      customer.address || null,
      customer.notes || null,
      customer.total_orders ?? 0,
      customer.lifetime_value ?? 0,
      customer.is_active !== undefined ? customer.is_active : 1,
      customer.created_at || new Date().toISOString(),
      customer.updated_at || new Date().toISOString(),
    ]);
  },

  /**
   * Batch upserts multiple customers in a single ACID transaction
   */
  async upsertBatch(customers: LocalCustomer[]): Promise<number> {
    if (!customers || customers.length === 0) return 0;
    const db = await getDatabase();

    const sql = `
      INSERT OR REPLACE INTO customers (
        id, organization_id, store_id, name, phone,
        email, address, notes, total_orders, lifetime_value,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await db.transaction(async (tx) => {
      for (const c of customers) {
        await tx.executeSql(sql, [
          c.id,
          c.organization_id || null,
          c.store_id,
          c.name,
          c.phone || null,
          c.email || null,
          c.address || null,
          c.notes || null,
          c.total_orders ?? 0,
          c.lifetime_value ?? 0,
          c.is_active !== undefined ? c.is_active : 1,
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString(),
        ]);
      }
    });

    return customers.length;
  },

  /**
   * Counts total cached customers
   */
  async count(storeId?: number): Promise<number> {
    const db = await getDatabase();
    let sql = 'SELECT COUNT(*) as count FROM customers WHERE is_active = 1';
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }

    const row = await db.getFirst<{ count: number }>(sql, params);
    return row ? Number(row.count) : 0;
  },
};

export default CustomerRepository;
