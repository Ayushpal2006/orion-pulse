/**
 * Apka Bill Mobile - Database Migration Runner
 *
 * Tracks and applies database schema migrations in strict version sequence.
 * Fully idempotent and preserves existing data across app launches.
 */

import { DatabaseExecutor, Migration } from '../types';
import { migration001 } from './001_initial_schema';
import { migration002 } from './002_sync_and_settings';

// List of all migrations in chronological order
export const MIGRATIONS: Migration[] = [
  migration001,
  migration002,
];

export async function runMigrations(db: DatabaseExecutor): Promise<number> {
  // 1. Ensure __migrations table exists
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // 2. Fetch already applied migration IDs
  const appliedRows = await db.getAll<{ id: number }>('SELECT id FROM __migrations ORDER BY id ASC;');
  const appliedIds = new Set(appliedRows.map((r) => r.id));

  let newlyApplied = 0;

  // 3. Run pending migrations in strict order
  for (const migration of MIGRATIONS) {
    if (!appliedIds.has(migration.id)) {
      console.log(`[DB] Applying migration ${migration.id}: ${migration.name}...`);
      await db.transaction(async (tx) => {
        await migration.up(tx);
        await tx.executeSql(
          'INSERT INTO __migrations (id, name, applied_at) VALUES (?, ?, ?);',
          [migration.id, migration.name, new Date().toISOString()]
        );
      });
      console.log(`[DB] ✅ Migration ${migration.id} applied successfully.`);
      newlyApplied++;
    }
  }

  return newlyApplied;
}
