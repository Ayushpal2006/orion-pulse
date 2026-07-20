import { db } from "../db";
import { purchase_orders, purchase_items, products, suppliers, supplier_ledger } from "../db/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { NotFoundError, ValidationError } from "../utils/errors";
import { getKolkataDateString } from "../utils/datetime";
import { InventoryMovementService } from "./inventory-movement.service";
import { purchaseRepository } from "../repositories";
import { ProfitService } from "./profit.service";

export class PurchaseService {
  private movementService = new InventoryMovementService();
  private profitService = new ProfitService();

  async generateNextPurchaseNumber(storeId: number, txClient?: any): Promise<string> {
    const client = txClient || db;
    const todayStr = getKolkataDateString();
    const prefix = `PRCH-${todayStr}-`;

    const rows = await client
      .select({ purchase_number: purchase_orders.purchase_number })
      .from(purchase_orders)
      .where(and(eq(purchase_orders.store_id, storeId), like(purchase_orders.purchase_number, `${prefix}%`)))
      .orderBy(desc(purchase_orders.id))
      .limit(1);

    let nextSeq = 1;
    if (rows[0]) {
      const parts = rows[0].purchase_number.split("-");
      if (parts.length === 3) {
        const seqNum = parseInt(parts[2], 10);
        if (!isNaN(seqNum)) {
          nextSeq = seqNum + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, "0")}`;
  }

  async create(data: any): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    if (!data.supplier_id) {
      throw new ValidationError("Supplier is required");
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new ValidationError("Purchase must contain at least one product item");
    }

    return db.transaction(async (tx) => {
      // 1. Verify supplier exists in store
      const [supplier] = await tx
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, data.supplier_id), eq(suppliers.store_id, storeId)))
        .limit(1);

      if (!supplier) {
        throw new NotFoundError("Supplier not found in this store");
      }

      const purchaseNumber = await this.generateNextPurchaseNumber(storeId, tx);

      let subtotalPaise = 0;
      const itemsData: any[] = [];
      const syncProductsList: any[] = [];

      // 2. Loop items to compute line totals, update stock and costing
      for (const item of data.items) {
        if (!item.product_id || !item.quantity || item.quantity <= 0) {
          throw new ValidationError("Product ID and quantity (> 0) are required for all items");
        }
        if (item.purchase_price === undefined || item.purchase_price < 0) {
          throw new ValidationError("Purchase price must be greater than or equal to 0");
        }

        // Fetch product details
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, item.product_id), eq(products.store_id, storeId)))
          .limit(1);

        if (!product) {
          throw new NotFoundError(`Product ID ${item.product_id} not found in this store`);
        }

        // Convert Rupees to paise
        const purchasePricePaise = Math.round(item.purchase_price * 100);
        const sellingPricePaise = Math.round(item.selling_price * 100);
        const lineTotalPaise = purchasePricePaise * item.quantity;
        subtotalPaise += lineTotalPaise;

        // Calculate average purchase cost
        const beforeStock = product.stock;
        const afterStock = beforeStock + item.quantity;
        let averageCostPaise = product.average_cost;
        if (averageCostPaise <= 0) {
          averageCostPaise = product.purchase_price;
        }
        const totalCostBefore = beforeStock * averageCostPaise;
        const totalCostAdded = item.quantity * purchasePricePaise;
        const newAverageCostPaise = afterStock > 0 ? Math.round((totalCostBefore + totalCostAdded) / afterStock) : purchasePricePaise;

        // margin & markup in percentage
        const margin = sellingPricePaise > 0 ? Math.round(((sellingPricePaise - purchasePricePaise) / sellingPricePaise) * 100) : 0;
        const markup = purchasePricePaise > 0 ? Math.round(((sellingPricePaise - purchasePricePaise) / purchasePricePaise) * 100) : 0;

        // Record stock increment & log inventory movement
        const movementResult = await this.movementService.recordMovement({
          productId: item.product_id,
          storeId,
          movementType: "PURCHASE",
          quantity: item.quantity,
          referenceType: "PURCHASE_ORDER",
          referenceId: purchaseNumber,
          createdBy: "System",
          reason: `Purchase Entry: invoice ${data.supplier_invoice_number || ""}`,
          costDetails: {
            averageCost: newAverageCostPaise,
            lastPurchaseCost: purchasePricePaise,
            margin,
            markup,
          }
        }, tx);

        // Update product selling price & purchase price directly
        const [updatedProduct] = await tx
          .update(products)
          .set({
            purchase_price: purchasePricePaise,
            selling_price: sellingPricePaise,
            updated_at: new Date()
          })
          .where(eq(products.id, item.product_id))
          .returning();

        if (updatedProduct) {
          syncProductsList.push({
            ...updatedProduct,
            created_at: updatedProduct.created_at.toISOString(),
            updated_at: updatedProduct.updated_at.toISOString()
          });
        }

        // Log cost snapshot for Profit Engine (fire-and-forget, non-blocking)
        this.profitService.logCostSnapshot(item.product_id, newAverageCostPaise, tx).catch(() => {});

        itemsData.push({
          product_id: item.product_id,
          quantity: item.quantity,
          purchase_price: purchasePricePaise,
          selling_price: sellingPricePaise,
          line_total: lineTotalPaise,
        });
      }

      // Convert header fields to paise
      const discountPaise = Math.round((data.discount || 0) * 100);
      const taxPaise = Math.round((data.tax || 0) * 100);
      const grandTotalPaise = subtotalPaise - discountPaise + taxPaise;

      // 3. Create PO via repository
      const createdPo = await purchaseRepository.create(
        {
          supplier_id: data.supplier_id,
          purchase_number: purchaseNumber,
          supplier_invoice_number: data.supplier_invoice_number || null,
          purchase_date: data.purchase_date || new Date().toISOString(),
          subtotal: subtotalPaise,
          discount: discountPaise,
          tax: taxPaise,
          grand_total: grandTotalPaise,
          payment_status: data.payment_status,
          payment_method: data.payment_method || null,
          notes: data.notes || null,
        },
        itemsData,
        tx
      );

      // 4. Update supplier balance & write ledger entry
      const [lockedSupplier] = await tx
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, data.supplier_id), eq(suppliers.store_id, storeId)))
        .for("update");
      if (!lockedSupplier) {
        throw new NotFoundError("Supplier not found");
      }

      const newBalance = lockedSupplier.current_balance + grandTotalPaise;
      await tx
        .update(suppliers)
        .set({ current_balance: newBalance })
        .where(eq(suppliers.id, data.supplier_id));

      await tx
        .insert(supplier_ledger)
        .values({
          store_id: storeId,
          supplier_id: data.supplier_id,
          transaction_type: "PURCHASE",
          amount: grandTotalPaise,
          balance: newBalance,
          reference: purchaseNumber,
        });

      // Trigger synchronization queues
      if (syncProductsList.length > 0) {
        try {
          const { SyncQueueManager } = require("./sync.service");
          for (const prod of syncProductsList) {
            SyncQueueManager.getInstance().enqueue("product", prod);
          }
        } catch (e) {}
      }

      return createdPo;
    });
  }

  async getAll(params?: { q?: string; startDate?: string; endDate?: string }): Promise<any[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }
    return purchaseRepository.getAll(params);
  }

  async getById(id: number): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const po = await purchaseRepository.getById(id);
    if (!po) return null;

    const items = await purchaseRepository.getItems(id);
    return { ...po, items };
  }

  async update(id: number, data: any): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    if (!data.supplier_id) {
      throw new ValidationError("Supplier is required");
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new ValidationError("Purchase must contain at least one product item");
    }

    return db.transaction(async (tx) => {
      // 1. Fetch existing PO
      const oldPo = await purchaseRepository.getById(id, tx);
      if (!oldPo) {
        throw new NotFoundError("Purchase order not found");
      }

      const oldItems = await purchaseRepository.getItems(id, tx);

      // 2. REVERSAL PHASE: Subtract old items stock adjustments
      for (const oldItem of oldItems) {
        // Record negative adjustment using recordMovement
        await this.movementService.recordMovement({
          productId: oldItem.product_id,
          storeId,
          movementType: "PURCHASE_CANCEL", // Subtracts quantity from stock
          quantity: oldItem.quantity,
          referenceType: "PURCHASE_ORDER",
          referenceId: oldPo.purchase_number,
          createdBy: "System",
          reason: `Purchase Update Reversal: PO ${oldPo.purchase_number}`,
        }, tx);
      }

      // Delete old items
      await purchaseRepository.deleteItems(id, tx);

      // 3. APPLY NEW ITEMS PHASE
      let subtotalPaise = 0;
      const newItemsData: any[] = [];
      const syncProductsList: any[] = [];

      for (const item of data.items) {
        if (!item.product_id || !item.quantity || item.quantity <= 0) {
          throw new ValidationError("Product ID and quantity (> 0) are required for all items");
        }
        if (item.purchase_price === undefined || item.purchase_price < 0) {
          throw new ValidationError("Purchase price must be greater than or equal to 0");
        }

        // Fetch product
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, item.product_id), eq(products.store_id, storeId)))
          .limit(1);

        if (!product) {
          throw new NotFoundError(`Product ID ${item.product_id} not found in this store`);
        }

        const purchasePricePaise = Math.round(item.purchase_price * 100);
        const sellingPricePaise = Math.round(item.selling_price * 100);
        const lineTotalPaise = purchasePricePaise * item.quantity;
        subtotalPaise += lineTotalPaise;

        // Calculate average purchase cost (with reversed stock base)
        const beforeStock = product.stock; // Already contains reversed (subtracted) stock
        const afterStock = beforeStock + item.quantity;
        let averageCostPaise = product.average_cost;
        if (averageCostPaise <= 0) {
          averageCostPaise = product.purchase_price;
        }
        const totalCostBefore = beforeStock * averageCostPaise;
        const totalCostAdded = item.quantity * purchasePricePaise;
        const newAverageCostPaise = afterStock > 0 ? Math.round((totalCostBefore + totalCostAdded) / afterStock) : purchasePricePaise;

        const margin = sellingPricePaise > 0 ? Math.round(((sellingPricePaise - purchasePricePaise) / sellingPricePaise) * 100) : 0;
        const markup = purchasePricePaise > 0 ? Math.round(((sellingPricePaise - purchasePricePaise) / purchasePricePaise) * 100) : 0;

        // Record stock increment & log inventory movement
        const movementResult = await this.movementService.recordMovement({
          productId: item.product_id,
          storeId,
          movementType: "PURCHASE",
          quantity: item.quantity,
          referenceType: "PURCHASE_ORDER",
          referenceId: oldPo.purchase_number,
          createdBy: "System",
          reason: `Purchase Update Receipt: invoice ${data.supplier_invoice_number || ""}`,
          costDetails: {
            averageCost: newAverageCostPaise,
            lastPurchaseCost: purchasePricePaise,
            margin,
            markup,
          }
        }, tx);

        // Update product pricing direct
        const [updatedProduct] = await tx
          .update(products)
          .set({
            purchase_price: purchasePricePaise,
            selling_price: sellingPricePaise,
            updated_at: new Date()
          })
          .where(eq(products.id, item.product_id))
          .returning();

        if (updatedProduct) {
          syncProductsList.push({
            ...updatedProduct,
            created_at: updatedProduct.created_at.toISOString(),
            updated_at: updatedProduct.updated_at.toISOString()
          });
        }

        newItemsData.push({
          purchase_order_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          purchase_price: purchasePricePaise,
          selling_price: sellingPricePaise,
          line_total: lineTotalPaise,
        });
      }

      // Convert header fields
      const discountPaise = Math.round((data.discount || 0) * 100);
      const taxPaise = Math.round((data.tax || 0) * 100);
      const grandTotalPaise = subtotalPaise - discountPaise + taxPaise;

      // Update PO and insert new items
      const updatedPo = await purchaseRepository.update(
        id,
        {
          supplier_id: data.supplier_id,
          supplier_invoice_number: data.supplier_invoice_number || null,
          purchase_date: data.purchase_date || new Date().toISOString(),
          subtotal: subtotalPaise,
          discount: discountPaise,
          tax: taxPaise,
          grand_total: grandTotalPaise,
          payment_status: data.payment_status,
          payment_method: data.payment_method || null,
          notes: data.notes || null,
        },
        tx
      );

      await purchaseRepository.insertItems(newItemsData, tx);

      // 4. Update supplier balance and ledger
      if (oldPo.supplier_id !== data.supplier_id) {
        // Revert old supplier balance
        const [oldSupplier] = await tx
          .select()
          .from(suppliers)
          .where(and(eq(suppliers.id, oldPo.supplier_id), eq(suppliers.store_id, storeId)))
          .for("update");
        if (oldSupplier) {
          const newOldBal = oldSupplier.current_balance - oldPo.grand_total;
          await tx
            .update(suppliers)
            .set({ current_balance: newOldBal })
            .where(eq(suppliers.id, oldPo.supplier_id));

          // Append cancel entry for old supplier
          await tx.insert(supplier_ledger).values({
            store_id: storeId,
            supplier_id: oldPo.supplier_id,
            transaction_type: "PURCHASE_CANCEL",
            amount: oldPo.grand_total,
            balance: newOldBal,
            reference: oldPo.purchase_number,
          });
        }

        // Add new supplier balance
        const [newSupplier] = await tx
          .select()
          .from(suppliers)
          .where(and(eq(suppliers.id, data.supplier_id), eq(suppliers.store_id, storeId)))
          .for("update");
        if (!newSupplier) {
          throw new NotFoundError("New supplier not found");
        }
        const newNewBal = newSupplier.current_balance + grandTotalPaise;
        await tx
          .update(suppliers)
          .set({ current_balance: newNewBal })
          .where(eq(suppliers.id, data.supplier_id));

        // Insert new entry for new supplier
        await tx.insert(supplier_ledger).values({
          store_id: storeId,
          supplier_id: data.supplier_id,
          transaction_type: "PURCHASE",
          amount: grandTotalPaise,
          balance: newNewBal,
          reference: oldPo.purchase_number,
        });

        const { supplierLedgerRepository } = require("../repositories");
        await supplierLedgerRepository.recalculateBalances(oldPo.supplier_id, tx);
        await supplierLedgerRepository.recalculateBalances(data.supplier_id, tx);
      } else {
        // Same supplier, update ledger entry and recalculate balance
        await tx
          .update(supplier_ledger)
          .set({ amount: grandTotalPaise })
          .where(and(
            eq(supplier_ledger.supplier_id, data.supplier_id),
            eq(supplier_ledger.reference, oldPo.purchase_number),
            eq(supplier_ledger.transaction_type, "PURCHASE")
          ));

        const { supplierLedgerRepository } = require("../repositories");
        await supplierLedgerRepository.recalculateBalances(data.supplier_id, tx);
      }

      // Trigger sync
      if (syncProductsList.length > 0) {
        try {
          const { SyncQueueManager } = require("./sync.service");
          for (const prod of syncProductsList) {
            SyncQueueManager.getInstance().enqueue("product", prod);
          }
        } catch (e) {}
      }

      return updatedPo;
    });
  }

  async delete(id: number): Promise<boolean> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    return db.transaction(async (tx) => {
      const oldPo = await purchaseRepository.getById(id, tx);
      if (!oldPo) {
        throw new NotFoundError("Purchase order not found");
      }

      const oldItems = await purchaseRepository.getItems(id, tx);

      // REVERSAL PHASE: Subtract stock adjustments
      for (const oldItem of oldItems) {
        await this.movementService.recordMovement({
          productId: oldItem.product_id,
          storeId,
          movementType: "PURCHASE_CANCEL", // Subtracts quantity from stock
          quantity: oldItem.quantity,
          referenceType: "PURCHASE_ORDER",
          referenceId: oldPo.purchase_number,
          createdBy: "System",
          reason: `Purchase Deletion: PO ${oldPo.purchase_number}`,
        }, tx);
      }

      // Update supplier balance and append cancel entry
      const [supplier] = await tx
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, oldPo.supplier_id), eq(suppliers.store_id, storeId)))
        .for("update");

      if (supplier) {
        const newBalance = supplier.current_balance - oldPo.grand_total;
        await tx
          .update(suppliers)
          .set({ current_balance: newBalance })
          .where(eq(suppliers.id, oldPo.supplier_id));

        await tx
          .insert(supplier_ledger)
          .values({
            store_id: storeId,
            supplier_id: oldPo.supplier_id,
            transaction_type: "PURCHASE_CANCEL",
            amount: oldPo.grand_total,
            balance: newBalance,
            reference: oldPo.purchase_number,
          });
      }

      // Delete PO (which cascade deletes purchase items)
      return purchaseRepository.delete(id, tx);
    });
  }
}
