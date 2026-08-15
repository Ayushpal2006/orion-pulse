/**
 * Apka Bill Mobile - Migration 002: Settings & Sync State Tables
 *
 * Defines tables for:
 * - settings: Key-value store settings bound to store context
 * - __sync_state: Local synchronization state metadata (lastSyncAt, sync markers)
 */

import { Migration, DatabaseExecutor } from '../types';

export const migration002: Migration = {
  id: 2,
  name: '002_sync_and_settings',
  up: async (db: DatabaseExecutor): Promise<void> => {
    // 1. Settings Table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        store_id INTEGER,
        value TEXT NOT NULL,
        updated_at TEXT
      );
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_settings_store 
      ON settings(store_id);
    `);

    // 2. Sync State Table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS __sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT
      );
    `);
  },

  down: async (db: DatabaseExecutor): Promise<void> => {
    await db.executeSql('DROP TABLE IF EXISTS __sync_state;');
    await db.executeSql('DROP TABLE IF EXISTS settings;');
  },
};

export default migration002;
