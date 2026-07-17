import { db } from "../db";
import { products, inventory_movements, inventory_logs } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { ValidationError } from "../utils/errors";

export class InventoryMovementService {
  async recordMovement(
    dto: {
      productId: number;
      storeId: number;
      movementType: "PURCHASE" | "SALE" | "VOID_INVOICE" | "PURCHASE_CANCEL" | "CUSTOMER_RETURN" | "DAMAGE" | "STOCK_ADJUSTMENT" | "OPENING_STOCK" | "TRANSFER";
      quantity: number;
      referenceType: "INVOICE" | "PURCHASE_ORDER" | "ADJUSTMENT" | "RETURN";
      referenceId: string;
      createdBy: string;
      reason?: string;
      costDetails?: {
        averageCost: number;
        lastPurchaseCost: number;
        margin: number;
        markup: number;
      };
    },
    tx?: any
  ): Promise<{ product: any; movement: any }> {
    const execute = async (dbClient: any) => {
      // 1. Fetch the product with update lock to avoid concurrent race conditions
      const [product] = await dbClient
        .select()
        .from(products)
        .where(and(eq(products.id, dto.productId), eq(products.store_id, dto.storeId)))
        .for("update");

      if (!product) {
        throw new ValidationError(`Product with ID ${dto.productId} not found in store ${dto.storeId}`);
      }

      const previousStock = product.stock;
      let newStock = previousStock;

      // Unify math operations for movement types
      switch (dto.movementType) {
        case "PURCHASE":
        case "VOID_INVOICE":
        case "CUSTOMER_RETURN":
        case "OPENING_STOCK":
          newStock = previousStock + dto.quantity;
          break;
        case "SALE":
        case "PURCHASE_CANCEL":
        case "DAMAGE":
        case "TRANSFER":
          newStock = previousStock - dto.quantity;
          break;
        case "STOCK_ADJUSTMENT":
          // For stock adjustment, the quantity passed can be positive or negative
          newStock = previousStock + dto.quantity;
          break;
        default:
          throw new ValidationError(`Unknown movement type: ${dto.movementType}`);
      }

      if (newStock < 0) {
        throw new ValidationError(
          `Cannot adjust stock below zero for "${product.name}". Current stock: ${previousStock}, requested quantity change: ${dto.quantity}`
        );
      }

      // 2. Prepare product update attributes
      const updateFields: any = {
        stock: newStock,
        updated_at: new Date(),
      };

      if (dto.costDetails) {
        updateFields.average_cost = dto.costDetails.averageCost;
        updateFields.last_purchase_cost = dto.costDetails.lastPurchaseCost;
        updateFields.margin_percent = dto.costDetails.margin;
        updateFields.markup_percent = dto.costDetails.markup;
      }

      // Update the product record
      const [updatedProduct] = await dbClient
        .update(products)
        .set(updateFields)
        .where(eq(products.id, dto.productId))
        .returning();

      // 3. Log to the new inventory_movements table
      const [movement] = await dbClient
        .insert(inventory_movements)
        .values({
          store_id: dto.storeId,
          movement_type: dto.movementType,
          product_id: dto.productId,
          quantity: dto.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reference_type: dto.referenceType,
          reference_id: dto.referenceId,
          reason: dto.reason || null,
          created_by: dto.createdBy,
        })
        .returning();

      // 4. ALSO insert into legacy inventory_logs for full backward compatibility
      let legacyType: string = dto.movementType;
      if (dto.movementType === "VOID_INVOICE") legacyType = "VOID";
      if (dto.movementType === "CUSTOMER_RETURN") legacyType = "RETURN";
      if (dto.movementType === "STOCK_ADJUSTMENT") legacyType = "ADJUSTMENT";

      await dbClient.insert(inventory_logs).values({
        product_id: dto.productId,
        store_id: dto.storeId,
        type: legacyType,
        quantity: dto.quantity,
        before_stock: previousStock,
        after_stock: newStock,
        reference: dto.referenceId,
      });

      // 5. Enqueue Google Sheets sync job for append-only movements log sheet
      try {
        const { SyncQueueManager } = require("./sync.service");
        SyncQueueManager.getInstance().enqueue("inventory_movement", {
          created_at: movement.created_at.toISOString(),
          product_id: dto.productId,
          product_name: product.name,
          movement_type: dto.movementType,
          reference_id: dto.referenceId,
          quantity: dto.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: dto.reason || "",
        });
      } catch (e) {
        console.error("❌ Failed to enqueue Inventory Movement sheets sync job:", e);
      }

      return { product: updatedProduct, movement };
    };

    if (tx) {
      return execute(tx);
    } else {
      return db.transaction(async (newTx) => {
        return execute(newTx);
      });
    }
  }

  // Wrapper helper methods
  async recordPurchase(
    productId: number,
    storeId: number,
    quantity: number,
    referenceId: string,
    createdBy: string,
    reason?: string,
    costDetails?: {
      averageCost: number;
      lastPurchaseCost: number;
      margin: number;
      markup: number;
    },
    tx?: any
  ) {
    return this.recordMovement(
      {
        productId,
        storeId,
        movementType: "PURCHASE",
        quantity,
        referenceType: "PURCHASE_ORDER",
        referenceId,
        createdBy,
        reason,
        costDetails,
      },
      tx
    );
  }

  async recordSale(
    productId: number,
    storeId: number,
    quantity: number,
    referenceId: string,
    createdBy: string,
    reason?: string,
    tx?: any
  ) {
    return this.recordMovement(
      {
        productId,
        storeId,
        movementType: "SALE",
        quantity,
        referenceType: "INVOICE",
        referenceId,
        createdBy,
        reason,
      },
      tx
    );
  }

  async recordVoidInvoice(
    productId: number,
    storeId: number,
    quantity: number,
    referenceId: string,
    createdBy: string,
    reason?: string,
    tx?: any
  ) {
    return this.recordMovement(
      {
        productId,
        storeId,
        movementType: "VOID_INVOICE",
        quantity,
        referenceType: "INVOICE",
        referenceId,
        createdBy,
        reason,
      },
      tx
    );
  }

  async recordPurchaseCancel(
    productId: number,
    storeId: number,
    quantity: number,
    referenceId: string,
    createdBy: string,
    reason?: string,
    tx?: any
  ) {
    return this.recordMovement(
      {
        productId,
        storeId,
        movementType: "PURCHASE_CANCEL",
        quantity,
        referenceType: "PURCHASE_ORDER",
        referenceId,
        createdBy,
        reason,
      },
      tx
    );
  }

  async recordCustomerReturn(
    productId: number,
    storeId: number,
    quantity: number,
    referenceId: string,
    createdBy: string,
    reason?: string,
    tx?: any
  ) {
    return this.recordMovement(
      {
        productId,
        storeId,
        movementType: "CUSTOMER_RETURN",
        quantity,
        referenceType: "RETURN",
        referenceId,
        createdBy,
        reason,
      },
      tx
    );
  }

  async recordStockAdjustment(
    productId: number,
    storeId: number,
    quantity: number,
    reason: string,
    createdBy: string,
    tx?: any
  ) {
    return this.recordMovement(
      {
        productId,
        storeId,
        movementType: "STOCK_ADJUSTMENT",
        quantity,
        referenceType: "ADJUSTMENT",
        referenceId: `ADJ-${new Date().getTime()}`,
        createdBy,
        reason,
      },
      tx
    );
  }

  // Future V2 placeholders
  async recordDamage(productId: number, storeId: number, quantity: number, reason: string, createdBy: string, tx?: any) {
    return this.recordMovement(
      {
        productId,
        storeId,
        movementType: "DAMAGE",
        quantity,
        referenceType: "ADJUSTMENT",
        referenceId: `DMG-${new Date().getTime()}`,
        createdBy,
        reason,
      },
      tx
    );
  }
}
