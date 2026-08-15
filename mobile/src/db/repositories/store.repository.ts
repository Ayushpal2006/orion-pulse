/**
 * Apka Bill Mobile - Store SQLite Repository
 *
 * Encapsulates local retail outlet / store configuration persistence and retrieval.
 */

import { getDatabase } from '../database';
import { LocalStore } from '../types';

export const StoreRepository = {
  /**
   * Retrieves the active or cached store context
   */
  async getStore(storeId?: number): Promise<LocalStore | null> {
    const db = await getDatabase();
    if (storeId !== undefined) {
      return db.getFirst<LocalStore>('SELECT * FROM stores WHERE id = ? LIMIT 1;', [storeId]);
    }
    return db.getFirst<LocalStore>('SELECT * FROM stores ORDER BY id ASC LIMIT 1;');
  },

  /**
   * Upserts the store entity (INSERT OR REPLACE)
   */
  async upsertStore(store: LocalStore): Promise<void> {
    const db = await getDatabase();
    const sql = `
      INSERT OR REPLACE INTO stores (
        id, organization_id, name, code, address,
        city, state, country, gst_number, phone,
        currency, timezone, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await db.executeSql(sql, [
      store.id,
      store.organization_id || null,
      store.name,
      store.code || null,
      store.address || null,
      store.city || null,
      store.state || null,
      store.country || null,
      store.gst_number || null,
      store.phone || null,
      store.currency || 'INR',
      store.timezone || 'Asia/Kolkata',
      store.status || 'active',
      store.created_at || new Date().toISOString(),
      store.updated_at || new Date().toISOString(),
    ]);
  },
};

export default StoreRepository;
