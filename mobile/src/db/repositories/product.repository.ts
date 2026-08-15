/**
 * Apka Bill Mobile - Product SQLite Repository
 *
 * Encapsulates all local product storage, search, and batch persistence logic.
 */

import { getDatabase } from '../database';
import { LocalProduct } from '../types';

export interface ProductQueryOptions {
  storeId?: number;
  isActiveOnly?: boolean;
  limit?: number;
  offset?: number;
}

export const ProductRepository = {
  /**
   * Retrieves products with optional store filtering and pagination
   */
  async getAll(options: ProductQueryOptions = {}): Promise<LocalProduct[]> {
    const db = await getDatabase();
    const { storeId, isActiveOnly = true, limit = 100, offset = 0 } = options;

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }

    if (isActiveOnly) {
      sql += ' AND is_active = 1';
    }

    sql += ' ORDER BY name ASC LIMIT ? OFFSET ?;';
    params.push(limit, offset);

    return db.getAll<LocalProduct>(sql, params);
  },

  /**
   * Finds a product by its primary server identifier
   */
  async getById(id: number): Promise<LocalProduct | null> {
    const db = await getDatabase();
    return db.getFirst<LocalProduct>('SELECT * FROM products WHERE id = ? LIMIT 1;', [id]);
  },

  /**
   * Finds a product by barcode (exact match)
   */
  async getByBarcode(barcode: string, storeId?: number): Promise<LocalProduct | null> {
    const db = await getDatabase();
    if (storeId !== undefined) {
      return db.getFirst<LocalProduct>(
        'SELECT * FROM products WHERE barcode = ? AND store_id = ? AND is_active = 1 LIMIT 1;',
        [barcode, storeId]
      );
    }
    return db.getFirst<LocalProduct>(
      'SELECT * FROM products WHERE barcode = ? AND is_active = 1 LIMIT 1;',
      [barcode]
    );
  },

  /**
   * Finds a product by SKU (exact match)
   */
  async getBySku(sku: string, storeId?: number): Promise<LocalProduct | null> {
    const db = await getDatabase();
    if (storeId !== undefined) {
      return db.getFirst<LocalProduct>(
        'SELECT * FROM products WHERE sku = ? AND store_id = ? AND is_active = 1 LIMIT 1;',
        [sku, storeId]
      );
    }
    return db.getFirst<LocalProduct>(
      'SELECT * FROM products WHERE sku = ? AND is_active = 1 LIMIT 1;',
      [sku]
    );
  },

  /**
   * Instant offline search by Name, SKU, or Barcode
   */
  async search(query: string, storeId?: number, limit = 50): Promise<LocalProduct[]> {
    const db = await getDatabase();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return this.getAll({ storeId, limit });
    }

    const searchParam = `%${cleanQuery}%`;
    let sql = `
      SELECT * FROM products 
      WHERE is_active = 1 
        AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
    `;
    const params: any[] = [searchParam, searchParam, searchParam];

    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }

    sql += ' ORDER BY name ASC LIMIT ?;';
    params.push(limit);

    return db.getAll<LocalProduct>(sql, params);
  },

  /**
   * Upserts a single product into SQLite (INSERT OR REPLACE)
   */
  async upsert(product: LocalProduct): Promise<void> {
    const db = await getDatabase();
    const sql = `
      INSERT OR REPLACE INTO products (
        id, organization_id, store_id, name, sku, barcode,
        category, selling_price, purchase_price, stock,
        minimum_stock, gst, is_active, image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await db.executeSql(sql, [
      product.id,
      product.organization_id || null,
      product.store_id,
      product.name,
      product.sku,
      product.barcode || null,
      product.category || null,
      product.selling_price,
      product.purchase_price || 0,
      product.stock ?? 0,
      product.minimum_stock ?? 0,
      product.gst ?? 18,
      product.is_active !== undefined ? product.is_active : 1,
      product.image_url || null,
      product.created_at || new Date().toISOString(),
      product.updated_at || new Date().toISOString(),
    ]);
  },

  /**
   * Batch upserts multiple products inside a single ACID transaction for high throughput
   */
  async upsertBatch(products: LocalProduct[]): Promise<number> {
    if (!products || products.length === 0) return 0;
    const db = await getDatabase();

    const sql = `
      INSERT OR REPLACE INTO products (
        id, organization_id, store_id, name, sku, barcode,
        category, selling_price, purchase_price, stock,
        minimum_stock, gst, is_active, image_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await db.transaction(async (tx) => {
      for (const p of products) {
        await tx.executeSql(sql, [
          p.id,
          p.organization_id || null,
          p.store_id,
          p.name,
          p.sku,
          p.barcode || null,
          p.category || null,
          p.selling_price,
          p.purchase_price || 0,
          p.stock ?? 0,
          p.minimum_stock ?? 0,
          p.gst ?? 18,
          p.is_active !== undefined ? p.is_active : 1,
          p.image_url || null,
          p.created_at || new Date().toISOString(),
          p.updated_at || new Date().toISOString(),
        ]);
      }
    });

    return products.length;
  },

  /**
   * Counts total cached products
   */
  async count(storeId?: number): Promise<number> {
    const db = await getDatabase();
    let sql = 'SELECT COUNT(*) as count FROM products WHERE is_active = 1';
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }

    const row = await db.getFirst<{ count: number }>(sql, params);
    return row ? Number(row.count) : 0;
  },
};

export default ProductRepository;
