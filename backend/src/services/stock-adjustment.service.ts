import { db } from "../db";
import { products, stock_adjustments } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { NotFoundError, ValidationError } from "../utils/errors";
import { InventoryMovementService } from "./inventory-movement.service";
import { stockAdjustmentRepository } from "../repositories";
import { CreateStockAdjustmentDTO, StockAdjustment } from "../types/stock-adjustment.types";

export class StockAdjustmentService {
  private movementService = new InventoryMovementService();

  async create(data: CreateStockAdjustmentDTO): Promise<StockAdjustment> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    if (!data.product_id) {
      throw new ValidationError("Product ID is required");
    }

    if (!data.adjustment_type) {
      throw new ValidationError("Adjustment type is required");
    }

    if (!data.reason || !data.reason.trim()) {
      throw new ValidationError("Reason is required");
    }

    return db.transaction(async (tx) => {
      // 1. Fetch product and lock record to avoid concurrency issues
      const [product] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, data.product_id), eq(products.store_id, storeId)))
        .for("update");

      if (!product) {
        throw new NotFoundError(`Product ID ${data.product_id} not found in this store`);
      }

      const beforeStock = product.stock;
      let change = 0;

      // Compute stock changes
      if (data.adjustment_type === "PHYSICAL_COUNT") {
        if (data.actual_count === undefined && data.quantity_change === undefined) {
          throw new ValidationError("Either quantity_change or actual_count is required for PHYSICAL_COUNT");
        }
        if (data.actual_count !== undefined) {
          change = data.actual_count - beforeStock;
        } else if (data.quantity_change !== undefined) {
          change = data.quantity_change;
        }
      } else {
        if (data.quantity_change === undefined) {
          throw new ValidationError(`quantity_change is required for adjustment type ${data.adjustment_type}`);
        }
        change = data.quantity_change;
      }

      const afterStock = beforeStock + change;

      // Prevent negative stock
      if (afterStock < 0) {
        throw new ValidationError(
          `Adjustment would result in negative stock for "${product.name}". Current: ${beforeStock}, requested change: ${change}`
        );
      }

      // 2. Adjust product stock and log to inventory_movements using recordMovement
      const movementResult = await this.movementService.recordMovement({
        productId: data.product_id,
        storeId,
        movementType: "STOCK_ADJUSTMENT",
        quantity: change,
        referenceType: "ADJUSTMENT",
        referenceId: `ADJ-${new Date().getTime()}`,
        createdBy: "System",
        reason: `${data.adjustment_type}: ${data.reason}`,
      }, tx);

      const updatedProduct = movementResult.product;

      // 3. Create stock_adjustments entry
      const created = await stockAdjustmentRepository.create(
        {
          product_id: data.product_id,
          adjustment_type: data.adjustment_type,
          quantity_before: beforeStock,
          quantity_change: change,
          quantity_after: afterStock,
          reason: data.reason.trim(),
          notes: data.notes || null,
          created_by: "System",
        },
        tx
      );

      // Trigger sync queues
      if (updatedProduct) {
        try {
          const { SyncQueueManager } = require("./sync.service");
          SyncQueueManager.getInstance().enqueue("product", {
            ...updatedProduct,
            created_at: updatedProduct.created_at.toISOString(),
            updated_at: updatedProduct.updated_at.toISOString()
          });
        } catch (e) {}
      }

      return created;
    });
  }

  async getAll(params?: {
    q?: string;
    startDate?: string;
    endDate?: string;
    product_id?: number;
    adjustment_type?: string;
  }): Promise<StockAdjustment[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }
    return stockAdjustmentRepository.getAll(params);
  }

  async getById(id: number): Promise<StockAdjustment | null> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }
    return stockAdjustmentRepository.getById(id);
  }
}
