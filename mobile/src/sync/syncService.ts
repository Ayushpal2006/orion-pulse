/**
 * Apka Bill Mobile - Synchronization Service
 *
 * Responsibilities:
 * - Coordinates read/pull initial and incremental synchronization
 * - Enforces concurrency safety (prevents duplicate simultaneous syncs)
 * - Safe ACID batch upserts into SQLite
 * - Advances sync timestamp only upon successful transaction commit
 * - Non-destructive: preserves existing local state on network failures or empty responses
 */

import { ApiClient } from '../api/client';
import { SyncOptions, SyncResult } from './syncTypes';
import { syncStateManager } from './syncState';
import {
  initDatabase,
  ProductRepository,
  CustomerRepository,
  StoreRepository,
  SettingsRepository,
  LocalProduct,
  LocalCustomer,
  LocalStore,
  LocalSetting,
} from '../db';
import { SyncWorker, QueueProcessingResult } from './syncWorker';

let activeSyncPromise: Promise<SyncResult> | null = null;

export const SyncService = {
  /**
   * Processes the offline sales sync queue
   */
  async syncSalesQueue(apiClient: ApiClient): Promise<QueueProcessingResult> {
    return SyncWorker.processSaleQueue(apiClient);
  },

  /**
   * Triggers full or incremental synchronization
   */
  async syncAll(apiClient: ApiClient, options: SyncOptions = {}): Promise<SyncResult> {
    // 1. Upload pending offline sales first
    try {
      await SyncWorker.processSaleQueue(apiClient);
    } catch (err: any) {
      console.warn('[SyncService] Sale queue sync error before catalog pull:', err.message);
    }

    // 2. Concurrency Lock: Return active promise if sync is already in progress
    if (activeSyncPromise) {
      console.log('[SyncService] Sync already in progress, returning active instance.');
      return activeSyncPromise;
    }

    activeSyncPromise = this._executeSync(apiClient, options);
    try {
      return await activeSyncPromise;
    } finally {
      activeSyncPromise = null;
    }
  },

  /**
   * Internal synchronization worker
   */
  async _executeSync(apiClient: ApiClient, options: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    await initDatabase();
    await syncStateManager.init();

    const currentState = syncStateManager.getState();
    const isIncremental = !options.forceFull && !!currentState.lastSyncAt;
    const lastSyncTimeStr = isIncremental ? currentState.lastSyncAt : undefined;

    syncStateManager.setPhase(isIncremental ? 'downloading_delta' : 'store_context');

    const result: SyncResult = {
      success: false,
      isIncremental,
      storeUpdated: false,
      productsCount: 0,
      customersCount: 0,
      settingsCount: 0,
      durationMs: 0,
      lastSyncAt: currentState.lastSyncAt,
    };

    try {
      // 1. Fetch Store Context (Ensure fresh store metadata)
      syncStateManager.setPhase('store_context');
      try {
        const storeRes = await apiClient.get<any>('/api/stores/current');
        if (storeRes.success && storeRes.data) {
          const s = storeRes.data;
          const localStore: LocalStore = {
            id: s.id,
            organization_id: s.organization_id || s.organizationId || null,
            name: s.name,
            code: s.code || null,
            address: s.address || null,
            city: s.city || null,
            state: s.state || null,
            country: s.country || null,
            gst_number: s.gst_number || s.gstNumber || null,
            phone: s.phone || null,
            currency: s.currency || 'INR',
            timezone: s.timezone || 'Asia/Kolkata',
            status: s.status || 'active',
            created_at: s.created_at || s.createdAt || new Date().toISOString(),
            updated_at: s.updated_at || s.updatedAt || new Date().toISOString(),
          };
          await StoreRepository.upsertStore(localStore);
          result.storeUpdated = true;
        }
      } catch (err: any) {
        console.warn('[SyncService] Could not refresh current store:', err.message);
      }

      // 2. Fetch Server Delta / Full Dataset
      syncStateManager.setPhase('downloading_delta');
      let downloadedProducts: any[] = [];
      let downloadedCustomers: any[] = [];
      let downloadedSettings: any[] = [];
      let serverSyncTime: string = new Date().toISOString();

      try {
        // Primary: Use dedicated sync download endpoint
        const syncUrl = lastSyncTimeStr
          ? `/api/sync/download?lastSyncTime=${encodeURIComponent(lastSyncTimeStr)}`
          : '/api/sync/download';

        const syncRes = await apiClient.get<any>(syncUrl);
        if (syncRes.success && syncRes.data) {
          downloadedProducts = syncRes.data.products || [];
          downloadedCustomers = syncRes.data.customers || [];
          downloadedSettings = syncRes.data.settings || [];
          serverSyncTime = syncRes.data.syncTime || new Date().toISOString();
        }
      } catch (err: any) {
        console.warn('[SyncService] /api/sync/download unavailable, falling back to REST endpoints:', err.message);

        // Fallback: Use standard REST endpoints
        const [prodRes, custRes, setRes] = await Promise.allSettled([
          apiClient.get<any>('/api/products'),
          apiClient.get<any>('/api/customers'),
          apiClient.get<any>('/api/settings'),
        ]);

        if (prodRes.status === 'fulfilled' && prodRes.value.success && Array.isArray(prodRes.value.data)) {
          downloadedProducts = prodRes.value.data;
        }
        if (custRes.status === 'fulfilled' && custRes.value.success && Array.isArray(custRes.value.data)) {
          downloadedCustomers = custRes.value.data;
        }
        if (setRes.status === 'fulfilled' && setRes.value.success && setRes.value.data) {
          if (Array.isArray(setRes.value.data)) {
            downloadedSettings = setRes.value.data;
          } else if (typeof setRes.value.data === 'object') {
            downloadedSettings = Object.entries(setRes.value.data).map(([k, v]) => ({
              key: k,
              value: typeof v === 'object' ? JSON.stringify(v) : String(v),
            }));
          }
        }
      }

      // 3. Ingest into SQLite using Batch Transactions
      syncStateManager.setPhase('upserting_sqlite');

      // A. Upsert Products
      if (downloadedProducts.length > 0) {
        const localProducts: LocalProduct[] = downloadedProducts.map((p: any) => ({
          id: p.id,
          organization_id: p.organization_id || p.organizationId || null,
          store_id: p.store_id || p.storeId || options.storeId || 1,
          name: p.name,
          sku: p.sku || `SKU-${p.id}`,
          barcode: p.barcode || null,
          category: p.category || null,
          selling_price: p.selling_price !== undefined ? p.selling_price : (p.sellingPrice || 0),
          purchase_price: p.purchase_price !== undefined ? p.purchase_price : (p.purchasePrice || 0),
          stock: p.stock !== undefined ? p.stock : 0,
          minimum_stock: p.minimum_stock || p.minimumStock || 0,
          gst: p.gst !== undefined ? p.gst : 18,
          is_active: p.is_active !== undefined ? p.is_active : (p.isActive ? 1 : 1),
          image_url: p.image_url || p.imageUrl || null,
          created_at: p.created_at || p.createdAt || new Date().toISOString(),
          updated_at: p.updated_at || p.updatedAt || new Date().toISOString(),
        }));

        result.productsCount = await ProductRepository.upsertBatch(localProducts);
      }

      // B. Upsert Customers
      if (downloadedCustomers.length > 0) {
        const localCustomers: LocalCustomer[] = downloadedCustomers.map((c: any) => ({
          id: c.id,
          organization_id: c.organization_id || c.organizationId || null,
          store_id: c.store_id || c.storeId || options.storeId || 1,
          name: c.name,
          phone: c.phone || null,
          email: c.email || null,
          address: c.address || null,
          notes: c.notes || null,
          total_orders: c.total_orders || c.totalOrders || 0,
          lifetime_value: c.lifetime_value || c.lifetimeValue || 0,
          is_active: c.is_active !== undefined ? c.is_active : 1,
          created_at: c.created_at || c.createdAt || new Date().toISOString(),
          updated_at: c.updated_at || c.updatedAt || new Date().toISOString(),
        }));

        result.customersCount = await CustomerRepository.upsertBatch(localCustomers);
      }

      // C. Upsert Settings
      if (downloadedSettings.length > 0) {
        const localSettings: LocalSetting[] = downloadedSettings.map((s: any) => ({
          key: s.key || s.name,
          store_id: s.store_id || s.storeId || options.storeId || null,
          value: typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value ?? ''),
          updated_at: s.updated_at || s.updatedAt || new Date().toISOString(),
        }));

        result.settingsCount = await SettingsRepository.upsertBatch(localSettings);
      }

      // 4. Mark Success & Advance Sync Marker
      const elapsed = Date.now() - startTime;
      result.success = true;
      result.durationMs = elapsed;
      result.lastSyncAt = serverSyncTime;

      await syncStateManager.markSuccess(result);
      console.log(`[SyncService] ✅ Sync completed in ${elapsed}ms: ${result.productsCount} prods, ${result.customersCount} custs, ${result.settingsCount} settings.`);

      return result;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      const errMsg: string = (error && typeof error === 'object' && error.message) ? String(error.message) : 'Synchronization failed';
      result.error = errMsg;

      await syncStateManager.markError(errMsg, elapsed);
      console.error('[SyncService] ❌ Sync failed:', error);

      // Preserves existing local SQLite data
      return result;
    }
  },

  /**
   * Resets local sync markers to trigger a fresh full sync next time
   */
  async resetSyncMarkers(): Promise<void> {
    await SettingsRepository.setSyncState('sync_last_successful_at', '');
    await syncStateManager.init();
  },
};

export default SyncService;
