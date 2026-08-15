/**
 * Apka Bill Mobile - Offline Sales Synchronization Worker
 *
 * Responsibilities:
 * - Deterministic FIFO sequential queue processing (preserves ledger order)
 * - Strict response validation (ensures valid server ID & invoice before marking SYNCED)
 * - Idempotent retries using stable idempotency keys
 * - Graceful authentication expiration handling (pauses queue, preserves items)
 * - Cold-start crash recovery for interrupted SYNCING items
 * - Deadlock-safe concurrency lock
 */

import { ApiClient } from '../api/client';
import { SyncQueueRepository } from '../db/repositories';
import { SyncQueueItem } from '../db/types';

let isQueueProcessing = false;
let lockTimestamp = 0;

export interface QueueProcessingResult {
  processed: number;
  succeeded: number;
  failed: number;
  authPaused?: boolean;
  pendingRemaining: number;
}

export const SyncWorker = {
  /**
   * Processes all ready items in the sync queue sequentially (FIFO)
   */
  async processSaleQueue(apiClient: ApiClient): Promise<QueueProcessingResult> {
    const now = Date.now();
    // Deadlock safety: auto-release lock if held > 60 seconds
    if (isQueueProcessing && now - lockTimestamp < 60000) {
      console.log('[SyncWorker] ⏳ Queue processing already active, skipping concurrent trigger.');
      const pendingRemaining = await SyncQueueRepository.countPending();
      return { processed: 0, succeeded: 0, failed: 0, pendingRemaining };
    }

    isQueueProcessing = true;
    lockTimestamp = now;

    const result: QueueProcessingResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      pendingRemaining: 0,
    };

    try {
      // 1. Crash recovery: recover items stuck in SYNCING state
      await SyncQueueRepository.recoverInterrupted();

      // 2. Fetch ready queue batch in strict chronological order (FIFO)
      const queueItems = await SyncQueueRepository.getPendingQueue(20);
      result.processed = queueItems.length;

      for (const item of queueItems) {
        const itemRes = await this._processItem(apiClient, item, result);
        if (itemRes.authExpired) {
          result.authPaused = true;
          console.warn('[SyncWorker] 🔒 Sync paused due to authentication expiration.');
          break; // Stop processing further items until re-authenticated
        }
      }

      result.pendingRemaining = await SyncQueueRepository.countPending();
      return result;
    } finally {
      isQueueProcessing = false;
      lockTimestamp = 0;
    }
  },

  /**
   * Processes a single sync queue item with idempotent retry handling & response validation
   */
  async _processItem(
    apiClient: ApiClient,
    item: SyncQueueItem,
    result: QueueProcessingResult
  ): Promise<{ authExpired?: boolean }> {
    console.log(`[SyncWorker] [SYNC] Starting item=${item.id} entity=${item.entity_local_id} attempt=${item.attempts + 1}`);

    try {
      await SyncQueueRepository.markSyncing(item.id);

      const payload = JSON.parse(item.payload);
      const idempotencyKey = item.idempotency_key;

      // Post to backend checkout with Idempotency headers & payload identifiers
      const response = await apiClient.post<any>('/api/checkout', {
        ...payload,
        offlineIdentifier: item.entity_local_id,
        offlineInvoiceNumber: payload.offlineInvoiceNumber,
      }, {
        headers: {
          'x-offline-id': idempotencyKey,
          'offline-id': idempotencyKey,
          'Idempotency-Key': idempotencyKey,
        },
      });

      // 1. Check for Authentication Errors
      if (response.error && response.error.toLowerCase().includes('unauthorized')) {
        await SyncQueueRepository.markAuthPaused(item.id, 'Session expired or token invalid');
        return { authExpired: true };
      }

      // 2. Validate Server Response Structure
      if (response.success && (response.data || (response as any).saleId)) {
        const data = response.data || response;
        const serverSaleId = Number(data.saleId || (data.sale && data.sale.id));
        const serverInvoice = String(data.invoice || (data.sale && data.sale.invoice_number) || payload.offlineInvoiceNumber);

        if (!serverSaleId || isNaN(serverSaleId) || serverSaleId <= 0 || !serverInvoice) {
          throw new Error(`Malformed server response: missing valid saleId or invoice number (${JSON.stringify(data)})`);
        }

        // 3. Atomically Update Local Records
        await SyncQueueRepository.markSynced(
          item.id,
          item.entity_local_id,
          serverSaleId,
          serverInvoice
        );

        console.log(`[SyncWorker] [SYNC] Success local_id=${item.entity_local_id} server_id=${serverSaleId} invoice=${serverInvoice}`);
        result.succeeded++;
        return {};
      } else {
        const errorMsg = response.error || 'Server rejected checkout';
        console.warn(`[SyncWorker] [SYNC] Failed local_id=${item.entity_local_id} error="${errorMsg}"`);
        await SyncQueueRepository.markFailed(item.id, errorMsg, false);
        result.failed++;
        return {};
      }
    } catch (err: any) {
      if (err.statusCode === 401 || (err.message && err.message.toLowerCase().includes('unauthorized'))) {
        await SyncQueueRepository.markAuthPaused(item.id, 'Session expired or token invalid');
        return { authExpired: true };
      }

      const errorMsg = err.message || 'Network error during sync';
      const isPermanent = err.statusCode === 400 || err.statusCode === 403;

      console.error(`[SyncWorker] [SYNC] Error local_id=${item.entity_local_id} attempt=${item.attempts + 1} reason="${errorMsg}" (permanent: ${isPermanent})`);
      await SyncQueueRepository.markFailed(item.id, errorMsg, isPermanent);
      result.failed++;
      return {};
    }
  },
};

export default SyncWorker;
