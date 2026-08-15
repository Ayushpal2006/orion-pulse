/**
 * Apka Bill Mobile - POS Data Ingestion & Persistence Service
 *
 * Responsibilities:
 * - Downloads catalog and tenant metadata from existing REST APIs
 * - Ingests records into local SQLite database via batch repository methods
 * - Preserves existing local data on network failure or empty responses
 */

import { ApiClient } from '../api/client';
import { ProductRepository, CustomerRepository, StoreRepository } from '../db';
import { LocalProduct, LocalCustomer, LocalStore } from '../db/types';

export interface CatalogSyncResult {
  success: boolean;
  storeUpdated: boolean;
  productsDownloaded: number;
  customersDownloaded: number;
  error?: string;
}

export const PosDataService = {
  /**
   * Downloads catalog entities from backend REST API and persists into local SQLite
   */
  async downloadCatalog(apiClient: ApiClient, storeId?: number): Promise<CatalogSyncResult> {
    const result: CatalogSyncResult = {
      success: false,
      storeUpdated: false,
      productsDownloaded: 0,
      customersDownloaded: 0,
    };

    try {
      // 1. Fetch & persist current store
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
        console.warn('[PosDataService] Could not fetch current store from API:', err.message);
      }

      // 2. Fetch & persist products
      try {
        const productsRes = await apiClient.get<any>('/api/products');
        if (productsRes.success && Array.isArray(productsRes.data) && productsRes.data.length > 0) {
          const localProducts: LocalProduct[] = productsRes.data.map((p: any) => ({
            id: p.id,
            organization_id: p.organization_id || p.organizationId || null,
            store_id: p.store_id || p.storeId || storeId || 1,
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

          const count = await ProductRepository.upsertBatch(localProducts);
          result.productsDownloaded = count;
        }
      } catch (err: any) {
        console.warn('[PosDataService] Could not fetch products from API:', err.message);
      }

      // 3. Fetch & persist customers
      try {
        const customersRes = await apiClient.get<any>('/api/customers');
        if (customersRes.success && Array.isArray(customersRes.data) && customersRes.data.length > 0) {
          const localCustomers: LocalCustomer[] = customersRes.data.map((c: any) => ({
            id: c.id,
            organization_id: c.organization_id || c.organizationId || null,
            store_id: c.store_id || c.storeId || storeId || 1,
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

          const count = await CustomerRepository.upsertBatch(localCustomers);
          result.customersDownloaded = count;
        }
      } catch (err: any) {
        console.warn('[PosDataService] Could not fetch customers from API:', err.message);
      }

      result.success = true;
      return result;
    } catch (err: any) {
      result.success = false;
      result.error = err.message || 'Failed to download catalog';
      return result;
    }
  },
};

export default PosDataService;
