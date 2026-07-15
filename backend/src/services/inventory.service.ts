import { db } from "../db";
import { products, inventory_adjustments, inventory_logs, suppliers } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { NotFoundError, ValidationError } from "../utils/errors";

export class InventoryService {
  async adjustStock(productId: number, quantity: number, type: "ADD" | "REMOVE", reason: string): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    if (quantity <= 0) {
      throw new ValidationError("Quantity must be greater than zero");
    }

    return db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, productId), eq(products.store_id, storeId)))
        .for("update");

      if (!product) {
        throw new NotFoundError(`Product with ID ${productId} not found`);
      }

      const beforeStock = product.stock;
      let afterStock = beforeStock;

      if (type === "ADD") {
        afterStock = beforeStock + quantity;
      } else if (type === "REMOVE") {
        afterStock = beforeStock - quantity;
        if (afterStock < 0) {
          throw new ValidationError(`Cannot adjust stock below zero. Current stock: ${beforeStock}`);
        }
      } else {
        throw new ValidationError("Adjustment type must be ADD or REMOVE");
      }

      // 1. Update product stock
      const [updatedProduct] = await tx
        .update(products)
        .set({ stock: afterStock, updated_at: new Date() })
        .where(eq(products.id, productId))
        .returning();

      // 2. Insert into adjustments
      const [adjustment] = await tx
        .insert(inventory_adjustments)
        .values({
          store_id: storeId,
          product_id: productId,
          type,
          quantity,
          reason,
          before_stock: beforeStock,
          after_stock: afterStock,
        })
        .returning();

      // 3. Log to inventory_logs
      await tx.insert(inventory_logs).values({
        product_id: productId,
        store_id: storeId,
        type: "ADJUSTMENT",
        quantity: type === "ADD" ? quantity : -quantity,
        before_stock: beforeStock,
        after_stock: afterStock,
        reference: `Manual Adjustment: ${reason}`,
      });

      return { adjustment, updatedProduct };
    });

    if (result.updatedProduct) {
      try {
        const { SyncQueueManager } = require("./sync.service");
        SyncQueueManager.getInstance().enqueue("product", {
          ...result.updatedProduct,
          created_at: result.updatedProduct.created_at.toISOString(),
          updated_at: result.updatedProduct.updated_at.toISOString()
        });
      } catch (e) {}
    }

    return result.adjustment;
  }

  async getReorderSuggestions(): Promise<any[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stock: products.stock,
        minimum_stock: products.minimum_stock,
        reorder_quantity: products.reorder_quantity,
        preferred_supplier: suppliers.company_name,
      })
      .from(products)
      .leftJoin(suppliers, eq(products.preferred_supplier_id, suppliers.id))
      .where(
        and(
          eq(products.is_active, 1),
          eq(products.store_id, storeId),
          sql`${products.stock} <= ${products.minimum_stock}`
        )
      );

    return rows;
  }

  async getInventoryValuation(): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const [summary] = await db
      .select({
        totalProducts: sql<string>`COUNT(*)`,
        totalStock: sql<string>`COALESCE(SUM(${products.stock}), 0)`,
        costValue: sql<string>`COALESCE(SUM(${products.stock} * ${products.average_cost}), 0)`,
        sellingValue: sql<string>`COALESCE(SUM(${products.stock} * ${products.selling_price}), 0)`,
      })
      .from(products)
      .where(and(eq(products.is_active, 1), eq(products.store_id, storeId)));

    const costVal = Number(summary?.costValue || 0);
    const sellVal = Number(summary?.sellingValue || 0);
    const potentialProfit = Math.max(0, sellVal - costVal);

    return {
      totalProducts: Number(summary?.totalProducts || 0),
      totalStock: Number(summary?.totalStock || 0),
      inventoryCostValue_INR: costVal / 100.0,
      inventorySellingValue_INR: sellVal / 100.0,
      potentialProfit_INR: potentialProfit / 100.0,
      margin_percent: sellVal > 0 ? Math.round((potentialProfit / sellVal) * 100) : 0,
    };
  }
}
