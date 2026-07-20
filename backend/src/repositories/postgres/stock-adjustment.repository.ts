import { IStockAdjustmentRepository } from "../interfaces/IStockAdjustmentRepository";
import { StockAdjustment } from "../../types/stock-adjustment.types";
import { db } from "../../db";
import { stock_adjustments, products } from "../../db/schema";
import { eq, and, desc, asc, like, or, sql, gte, lte } from "drizzle-orm";
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
    let cond = sql`1=1`;

    if (storeId !== undefined) {
      cond = and(cond, eq(stock_adjustments.store_id, storeId)) as any;
    }

    if (params?.product_id) {
      cond = and(cond, eq(stock_adjustments.product_id, params.product_id)) as any;
    }

    if (params?.adjustment_type) {
      cond = and(cond, eq(stock_adjustments.adjustment_type, params.adjustment_type)) as any;
    }

    if (params?.q) {
      const searchLike = `%${params.q}%`;
      cond = and(
        cond,
        or(
          like(products.name, searchLike),
          like(stock_adjustments.reason, searchLike),
          like(stock_adjustments.adjustment_type, searchLike)
        )
      ) as any;
    }

    if (params?.startDate) {
      cond = and(cond, gte(stock_adjustments.created_at, new Date(params.startDate))) as any;
    }

    if (params?.endDate) {
      cond = and(cond, lte(stock_adjustments.created_at, new Date(params.endDate))) as any;
    }

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
      .innerJoin(products, eq(stock_adjustments.product_id, products.id))
      .where(cond)
      .orderBy(desc(stock_adjustments.id));

    return rows.map((r: any) => ({
      ...r,
      created_at: r.created_at.toISOString(),
    }));
  }

  async getById(id: number, tx?: any): Promise<StockAdjustment | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(stock_adjustments.id, id);

    if (storeId !== undefined) {
      cond = and(cond, eq(stock_adjustments.store_id, storeId)) as any;
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
      .innerJoin(products, eq(stock_adjustments.product_id, products.id))
      .where(cond)
      .limit(1);

    if (!adj) return null;

    return {
      ...adj,
      created_at: adj.created_at.toISOString(),
    } as StockAdjustment;
  }
}
