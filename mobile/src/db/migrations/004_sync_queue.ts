/**
 * Apka Bill Mobile - Migration 004: Sync Queue Table
 *
 * Defines the persistent SQLite sync_queue table for offline sale uploads.
 */

import { Migration, DatabaseExecutor } from '../types';

export const migration004: Migration = {
  id: 4,
  name: '004_sync_queue',
  up: async (db: DatabaseExecutor): Promise<void> => {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT DEFAULT 'SALE' NOT NULL,
        entity_local_id TEXT NOT NULL,
        operation TEXT DEFAULT 'CREATE' NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING' NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        next_attempt_at TEXT NOT NULL,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status 
      ON sync_queue(status, next_attempt_at);
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_entity 
      ON sync_queue(entity_type, entity_local_id);
    `);

    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_idempotency 
      ON sync_queue(idempotency_key);
    `);
  },

  down: async (db: DatabaseExecutor): Promise<void> => {
    await db.executeSql('DROP TABLE IF EXISTS sync_queue;');
  },
};

export default migration004;
