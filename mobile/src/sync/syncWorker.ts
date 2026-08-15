/**
 * Apka Bill Mobile - Offline Sales Synchronization Worker
 *
 * Responsibilities:
 * - Processes pending sales in sync_queue with exponential backoff
 * - Sends idempotent payload to backend POST /api/checkout
 * - Prevents duplicate sales across network retries
 * - Recovers interrupted queue items after app crash
 * - Updates local SQLite sale records upon server acknowledgment
 */

import { ApiClient } from '../api/client';
import { SyncQueueRepository, SaleRepository } from '../db/repositories';
import { SyncQueueItem } from '../db/types';

let isQueueProcessing = false;

export interface QueueProcessingResult {
  processed: number;
  succeeded: number;
  failed: number;
  pendingRemaining: number;
}

export const SyncWorker = {
  /**
   * Processes all ready items in the sync queue
   */
  async processSaleQueue(apiClient: ApiClient): Promise<QueueProcessingResult> {
    if (isQueueProcessing) {
      console.log('[SyncWorker] ⏳ Queue processing already in progress, skipping concurrent trigger.');
      const pendingRemaining = await SyncQueueRepository.countPending();
      return { processed: 0, succeeded: 0, failed: 0, pendingRemaining };
    }

    isQueueProcessing = true;
    const result: QueueProcessingResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      pendingRemaining: 0,
    };

    try {
      // 1. Crash recovery: recover items stuck in SYNCING state
      await SyncQueueRepository.recoverInterrupted();

      // 2. Fetch ready queue batch
      const queueItems = await SyncQueueRepository.getPendingQueue(20);
      result.processed = queueItems.length;

      for (const item of queueItems) {
        await this._processItem(apiClient, item, result);
      }

      result.pendingRemaining = await SyncQueueRepository.countPending();
      return result;
    } finally {
      isQueueProcessing = false;
    }
  },

  /**
   * Processes a single sync queue item with idempotent retry handling
   */
  async _processItem(
    apiClient: ApiClient,
    item: SyncQueueItem,
    result: QueueProcessingResult
  ): Promise<void> {
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

      if (response.success && (response.data || (response as any).saleId)) {
        const data = response.data || response;
        const serverSaleId = data.saleId || (data.sale && data.sale.id) || 0;
        const serverInvoice = data.invoice || (data.sale && data.sale.invoice_number) || payload.offlineInvoiceNumber;

        await SyncQueueRepository.markSynced(
          item.id,
          item.entity_local_id,
          serverSaleId,
          serverInvoice
        );

        console.log(`[SyncWorker] [SYNC] Success local_id=${item.entity_local_id} server_id=${serverSaleId} invoice=${serverInvoice}`);
        result.succeeded++;
      } else {
        const errorMsg = response.error || 'Server rejected checkout';
        console.warn(`[SyncWorker] [SYNC] Failed local_id=${item.entity_local_id} error="${errorMsg}"`);
        await SyncQueueRepository.markFailed(item.id, errorMsg, false);
        result.failed++;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network error during sync';
      const isPermanent = err.statusCode === 400 || err.statusCode === 403;

      console.error(`[SyncWorker] [SYNC] Error local_id=${item.entity_local_id} attempt=${item.attempts + 1} reason="${errorMsg}" (permanent: ${isPermanent})`);
      await SyncQueueRepository.markFailed(item.id, errorMsg, isPermanent);
      result.failed++;
    }
  },
};

export default SyncWorker;
