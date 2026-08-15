/**
 * Apka Bill Mobile - Settings & Sync State SQLite Repository
 *
 * Encapsulates key-value settings and sync marker persistence in SQLite.
 */

import { getDatabase } from '../database';

export interface LocalSetting {
  key: string;
  store_id?: number | null;
  value: string;
  updated_at?: string;
}

export const SettingsRepository = {
  /**
   * Retrieves a setting value by key
   */
  async get(key: string, defaultValue?: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirst<{ value: string }>(
      'SELECT value FROM settings WHERE key = ? LIMIT 1;',
      [key]
    );
    return row ? row.value : (defaultValue ?? null);
  },

  /**
   * Retrieves all settings as a key-value object
   */
  async getAll(storeId?: number): Promise<Record<string, string>> {
    const db = await getDatabase();
    let sql = 'SELECT key, value FROM settings WHERE 1=1';
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND (store_id = ? OR store_id IS NULL)';
      params.push(storeId);
    }

    const rows = await db.getAll<{ key: string; value: string }>(sql, params);
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return map;
  },

  /**
   * Sets a single setting
   */
  async set(key: string, value: string, storeId?: number | null): Promise<void> {
    const db = await getDatabase();
    const sql = `
      INSERT OR REPLACE INTO settings (key, store_id, value, updated_at)
      VALUES (?, ?, ?, ?);
    `;
    await db.executeSql(sql, [
      key,
      storeId ?? null,
      value,
      new Date().toISOString(),
    ]);
  },

  /**
   * Batch upserts settings from server
   */
  async upsertBatch(settings: LocalSetting[]): Promise<number> {
    if (!settings || settings.length === 0) return 0;
    const db = await getDatabase();

    const sql = `
      INSERT OR REPLACE INTO settings (key, store_id, value, updated_at)
      VALUES (?, ?, ?, ?);
    `;

    await db.transaction(async (tx) => {
      for (const s of settings) {
        await tx.executeSql(sql, [
          s.key,
          s.store_id ?? null,
          s.value,
          s.updated_at || new Date().toISOString(),
        ]);
      }
    });

    return settings.length;
  },

  /**
   * Retrieves a persistent sync state value
   */
  async getSyncState(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirst<{ value: string }>(
      'SELECT value FROM __sync_state WHERE key = ? LIMIT 1;',
      [key]
    );
    return row ? row.value : null;
  },

  /**
   * Sets a persistent sync state value
   */
  async setSyncState(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    const sql = `
      INSERT OR REPLACE INTO __sync_state (key, value, updated_at)
      VALUES (?, ?, ?);
    `;
    await db.executeSql(sql, [key, value, new Date().toISOString()]);
  },
};

export default SettingsRepository;
