import { IStockAdjustmentRepository } from "../interfaces/IStockAdjustmentRepository";
import { StockAdjustment } from "../../types/stock-adjustment.types";
import { db } from "../../db";
import { inventory_adjustments, products } from "../../db/schema";
import { eq, and, desc, like, or, gte, lte } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresStockAdjustmentRepository implements IStockAdjustmentRepository {
  async create(adjData: any, tx?: any): Promise<StockAdjustment> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const [created] = await client
      .insert(inventory_adjustments)
      .values({
        store_id: storeId,
        product_id: adjData.product_id,
        type: adjData.adjustment_type,
        quantity: adjData.quantity_change,
        reason: adjData.reason,
        before_stock: adjData.quantity_before,
        after_stock: adjData.quantity_after,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert stock adjustment record");
    }

    return {
      id: created.id,
      store_id: created.store_id,
      product_id: created.product_id,
      adjustment_type: created.type as any,
      quantity_before: created.before_stock,
      quantity_change: created.quantity,
      quantity_after: created.after_stock,
      reason: created.reason,
      notes: null,
      created_by: "System",
      created_at: created.created_at.toISOString(),
    };
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
      conditions.push(eq(inventory_adjustments.store_id, storeId));
    }

    if (params?.product_id) {
      conditions.push(eq(inventory_adjustments.product_id, params.product_id));
    }

    if (params?.adjustment_type) {
      conditions.push(eq(inventory_adjustments.type, params.adjustment_type));
    }

    if (params?.q) {
      const searchLike = `%${params.q}%`;
      conditions.push(
        or(
          like(products.name, searchLike),
          like(inventory_adjustments.reason, searchLike),
          like(inventory_adjustments.type, searchLike)
        )
      );
    }

    if (params?.startDate) {
      conditions.push(gte(inventory_adjustments.created_at, new Date(params.startDate)));
    }

    if (params?.endDate) {
      conditions.push(lte(inventory_adjustments.created_at, new Date(params.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select({
        id: inventory_adjustments.id,
        store_id: inventory_adjustments.store_id,
        product_id: inventory_adjustments.product_id,
        adjustment_type: inventory_adjustments.type,
        quantity_before: inventory_adjustments.before_stock,
        quantity_change: inventory_adjustments.quantity,
        quantity_after: inventory_adjustments.after_stock,
        reason: inventory_adjustments.reason,
        created_at: inventory_adjustments.created_at,
        product_name: products.name,
        product_sku: products.sku,
      })
      .from(inventory_adjustments)
      .leftJoin(products, eq(inventory_adjustments.product_id, products.id))
      .where(whereClause)
      .orderBy(desc(inventory_adjustments.id));

    return rows.map((r: any) => ({
      id: r.id,
      store_id: r.store_id,
      product_id: r.product_id,
      adjustment_type: r.adjustment_type as any,
      quantity_before: r.quantity_before,
      quantity_change: r.quantity_change,
      quantity_after: r.quantity_after,
      reason: r.reason,
      notes: null,
      created_by: "System",
      product_name: r.product_name || "Unknown Product",
      product_sku: r.product_sku || "N/A",
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  async getById(id: number, tx?: any): Promise<StockAdjustment | null> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [eq(inventory_adjustments.id, id)];

    if (storeId !== undefined) {
      conditions.push(eq(inventory_adjustments.store_id, storeId));
    }

    const [adj] = await client
      .select({
        id: inventory_adjustments.id,
        store_id: inventory_adjustments.store_id,
        product_id: inventory_adjustments.product_id,
        adjustment_type: inventory_adjustments.type,
        quantity_before: inventory_adjustments.before_stock,
        quantity_change: inventory_adjustments.quantity,
        quantity_after: inventory_adjustments.after_stock,
        reason: inventory_adjustments.reason,
        created_at: inventory_adjustments.created_at,
        product_name: products.name,
        product_sku: products.sku,
      })
      .from(inventory_adjustments)
      .leftJoin(products, eq(inventory_adjustments.product_id, products.id))
      .where(and(...conditions))
      .limit(1);

    if (!adj) return null;

    return {
      id: adj.id,
      store_id: adj.store_id,
      product_id: adj.product_id,
      adjustment_type: adj.adjustment_type as any,
      quantity_before: adj.quantity_before,
      quantity_change: adj.quantity_change,
      quantity_after: adj.quantity_after,
      reason: adj.reason,
      notes: null,
      created_by: "System",
      product_name: adj.product_name || "Unknown Product",
      product_sku: adj.product_sku || "N/A",
      created_at: adj.created_at ? new Date(adj.created_at).toISOString() : new Date().toISOString(),
    };
  }
}
