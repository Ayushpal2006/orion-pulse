import { IStockAdjustmentRepository } from "../interfaces/IStockAdjustmentRepository";
import { StockAdjustment } from "../../types/stock-adjustment.types";
import { db } from "../../db";
import { stock_adjustments, products } from "../../db/schema";
import { eq, and, desc, like, or, gte, lte } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresStockAdjustmentRepository implements IStockAdjustmentRepository {
  async create(adjData: any, tx?: any): Promise<StockAdjustment> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const [created] = await client
      .insert(stock_adjustments)
      .values({
        store_id: storeId,
        product_id: adjData.product_id,
        adjustment_type: adjData.adjustment_type,
        quantity_before: adjData.quantity_before,
        quantity_change: adjData.quantity_change,
        quantity_after: adjData.quantity_after,
        reason: adjData.reason,
        notes: adjData.notes || null,
        created_by: adjData.created_by || "System",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert stock adjustment record");
    }

    return {
      ...created,
      created_at: created.created_at.toISOString(),
    } as StockAdjustment;
  }

  async getAll(
    params?: {
      q?: string;
      startDate?: string;
      endDate?: string;
      product_id?: number;
      adjustment_type?: string;
    },
    tx?: any
  ): Promise<StockAdjustment[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [];

    if (storeId !== undefined) {
      conditions.push(eq(stock_adjustments.store_id, storeId));
    }

    if (params?.product_id) {
      conditions.push(eq(stock_adjustments.product_id, params.product_id));
    }

    if (params?.adjustment_type) {
      conditions.push(eq(stock_adjustments.adjustment_type, params.adjustment_type));
    }

    if (params?.q) {
      const searchLike = `%${params.q}%`;
      conditions.push(
        or(
          like(products.name, searchLike),
          like(stock_adjustments.reason, searchLike),
          like(stock_adjustments.adjustment_type, searchLike)
        )
      );
    }

    if (params?.startDate) {
      conditions.push(gte(stock_adjustments.created_at, new Date(params.startDate)));
    }

    if (params?.endDate) {
      conditions.push(lte(stock_adjustments.created_at, new Date(params.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select({
        id: stock_adjustments.id,
        store_id: stock_adjustments.store_id,
        product_id: stock_adjustments.product_id,
        adjustment_type: stock_adjustments.adjustment_type,
        quantity_before: stock_adjustments.quantity_before,
        quantity_change: stock_adjustments.quantity_change,
        quantity_after: stock_adjustments.quantity_after,
        reason: stock_adjustments.reason,
        notes: stock_adjustments.notes,
        created_by: stock_adjustments.created_by,
        created_at: stock_adjustments.created_at,
        product_name: products.name,
        product_sku: products.sku,
      })
      .from(stock_adjustments)
      .leftJoin(products, eq(stock_adjustments.product_id, products.id))
      .where(whereClause)
      .orderBy(desc(stock_adjustments.id));

    return rows.map((r: any) => ({
      ...r,
      product_name: r.product_name || "Unknown Product",
      product_sku: r.product_sku || "N/A",
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  async getById(id: number, tx?: any): Promise<StockAdjustment | null> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [eq(stock_adjustments.id, id)];

    if (storeId !== undefined) {
      conditions.push(eq(stock_adjustments.store_id, storeId));
    }

    const [adj] = await client
      .select({
        id: stock_adjustments.id,
        store_id: stock_adjustments.store_id,
        product_id: stock_adjustments.product_id,
        adjustment_type: stock_adjustments.adjustment_type,
        quantity_before: stock_adjustments.quantity_before,
        quantity_change: stock_adjustments.quantity_change,
        quantity_after: stock_adjustments.quantity_after,
        reason: stock_adjustments.reason,
        notes: stock_adjustments.notes,
        created_by: stock_adjustments.created_by,
        created_at: stock_adjustments.created_at,
        product_name: products.name,
        product_sku: products.sku,
      })
      .from(stock_adjustments)
      .leftJoin(products, eq(stock_adjustments.product_id, products.id))
      .where(and(...conditions))
      .limit(1);

    if (!adj) return null;

    return {
      ...adj,
      product_name: adj.product_name || "Unknown Product",
      product_sku: adj.product_sku || "N/A",
      created_at: adj.created_at ? new Date(adj.created_at).toISOString() : new Date().toISOString(),
    } as StockAdjustment;
  }
}
