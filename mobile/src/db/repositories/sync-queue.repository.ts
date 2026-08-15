/**
 * Apka Bill Mobile - Sync Queue Repository
 *
 * Encapsulates sync_queue persistence, retry state tracking, and status transitions.
 */

import { getDatabase } from '../database';
import { SyncQueueItem } from '../types';

export const SyncQueueRepository = {
  /**
   * Retrieves pending/retryable sync queue items ordered chronologically (FIFO)
   */
  async getPendingQueue(limit = 10): Promise<SyncQueueItem[]> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    const sql = `
      SELECT * FROM sync_queue 
      WHERE status IN ('PENDING', 'FAILED') 
        AND next_attempt_at <= ? 
      ORDER BY created_at ASC 
      LIMIT ?;
    `;

    return db.getAll<SyncQueueItem>(sql, [nowIso, limit]);
  },

  /**
   * Transitions a queue item to SYNCING
   */
  async markSyncing(id: string): Promise<void> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.executeSql(
      `UPDATE sync_queue 
       SET status = 'SYNCING', updated_at = ? 
       WHERE id = ?;`,
      [nowIso, id]
    );
  },

  /**
   * Marks a queue item as SYNCED and updates the corresponding local sale record atomically
   */
  async markSynced(
    queueId: string,
    saleLocalId: string,
    serverSaleId: number,
    serverInvoiceNumber: string
  ): Promise<void> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.transaction(async (tx) => {
      // 1. Update Queue Item
      await tx.executeSql(
        `UPDATE sync_queue 
         SET status = 'SYNCED', updated_at = ? 
         WHERE id = ?;`,
        [nowIso, queueId]
      );

      // 2. Update Local Sale Record
      await tx.executeSql(
        `UPDATE sales 
         SET server_id = ?, invoice_number = ?, sync_status = 'SYNCED', updated_at = ? 
         WHERE local_id = ?;`,
        [serverSaleId, serverInvoiceNumber, nowIso, saleLocalId]
      );
    });
  },

  /**
   * Handles failure with bounded exponential backoff
   */
  async markFailed(queueId: string, error: string, isPermanent = false): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const queueItem = await db.getFirst<SyncQueueItem>(
      'SELECT * FROM sync_queue WHERE id = ? LIMIT 1;',
      [queueId]
    );

    const nextAttempts = (queueItem?.attempts || 0) + 1;
    // Exponential backoff: 2s, 4s, 8s, 16s, max 300s (5 mins)
    const backoffSeconds = Math.min(300, Math.pow(2, nextAttempts));
    const nextAttemptAt = isPermanent
      ? new Date(now + 86400000 * 365).toISOString() // Deferred far into future
      : new Date(now + backoffSeconds * 1000).toISOString();

    const status = isPermanent || nextAttempts >= 10 ? 'FAILED' : 'PENDING';

    await db.executeSql(
      `UPDATE sync_queue 
       SET status = ?, attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? 
       WHERE id = ?;`,
      [status, nextAttempts, nextAttemptAt, error, nowIso, queueId]
    );
  },

  /**
   * Resets an item to PENDING on auth error without penalizing retry attempts
   */
  async markAuthPaused(queueId: string, reason: string): Promise<void> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.executeSql(
      `UPDATE sync_queue 
       SET status = 'PENDING', next_attempt_at = ?, last_error = ?, updated_at = ? 
       WHERE id = ?;`,
      [nowIso, `Auth Required: ${reason}`, nowIso, queueId]
    );
  },

  /**
   * Manually resets a FAILED item back to PENDING for user-initiated retry
   */
  async resetFailed(queueId: string): Promise<void> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.executeSql(
      `UPDATE sync_queue 
       SET status = 'PENDING', attempts = 0, next_attempt_at = ?, last_error = NULL, updated_at = ? 
       WHERE id = ?;`,
      [nowIso, nowIso, queueId]
    );
  },

  /**
   * Recovers items stuck in SYNCING state from previous app crashes
   */
  async recoverInterrupted(): Promise<number> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    const res = await db.executeSql(
      `UPDATE sync_queue 
       SET status = 'PENDING', next_attempt_at = ?, updated_at = ? 
       WHERE status = 'SYNCING';`,
      [nowIso, nowIso]
    );

    const count = res?.rowsAffected || 0;
    if (count > 0) {
      console.log(`[SyncQueue] 🔄 Recovered ${count} interrupted sync queue items back to PENDING.`);
    }
    return count;
  },

  /**
   * Returns count of queue items waiting to sync
   */
  async countPending(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirst<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('PENDING', 'SYNCING', 'FAILED');"
    );
    return row ? Number(row.count) : 0;
  },

  /**
   * Inserts an item into sync queue within a transaction
   */
  async enqueueItem(
    tx: any,
    item: {
      id: string;
      entity_type: 'SALE' | 'CUSTOMER' | 'ADJUSTMENT';
      entity_local_id: string;
      operation: 'CREATE' | 'UPDATE';
      idempotency_key: string;
      payload: any;
    }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const payloadStr = typeof item.payload === 'string' ? item.payload : JSON.stringify(item.payload);

    await tx.executeSql(
      `INSERT INTO sync_queue (
        id, entity_type, entity_local_id, operation, idempotency_key,
        payload, status, attempts, next_attempt_at, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, NULL, ?, ?);`,
      [
        item.id,
        item.entity_type,
        item.entity_local_id,
        item.operation,
        item.idempotency_key,
        payloadStr,
        nowIso,
        nowIso,
        nowIso,
      ]
    );
  },
};

export default SyncQueueRepository;
