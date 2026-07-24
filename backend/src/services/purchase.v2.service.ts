import { db } from "../db";
import { purchase_orders, purchase_items, products, suppliers, supplier_ledger, inventory_movements, inventory_logs, product_cost_history } from "../db/schema";
import { eq, and, desc, like } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { NotFoundError, ValidationError } from "../utils/errors";
import { getKolkataDateString } from "../utils/datetime";
import { purchaseV2Repository } from "../repositories/postgres/purchase.v2.repository";

export class PurchaseV2Service {
  private repository = purchaseV2Repository;

  async generateNextPurchaseNumber(storeId: number, txClient?: any): Promise<string> {
    const client = txClient || db;
    const todayStr = getKolkataDateString();
    const prefix = `PRCH-${todayStr}-`;

    const rows = await client
      .select({ po_number: purchase_orders.po_number })
      .from(purchase_orders)
      .where(and(eq(purchase_orders.store_id, storeId), like(purchase_orders.po_number, `${prefix}%`)))
      .orderBy(desc(purchase_orders.id))
      .limit(1);

    let nextSeq = 1;
    if (rows[0] && rows[0].po_number) {
      const parts = rows[0].po_number.split("-");
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
      // 1. Verify and lock supplier in store
      const [supplier] = await tx
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, data.supplier_id), eq(suppliers.store_id, storeId)))
        .for("update");

      if (!supplier) {
        throw new NotFoundError("Supplier not found in this store");
      }

      const poNumber = data.po_number || data.purchase_number || (await this.generateNextPurchaseNumber(storeId, tx));
      const invNumber = data.invoice_number || data.supplier_invoice_number || null;
      const invDate = data.invoice_date || data.purchase_date || new Date().toISOString();

      let subtotalPaise = 0;
      const itemsData: any[] = [];

      // 2. Process items: calculate cost, update stock, log movement & cost history
      for (const item of data.items) {
        if (!item.product_id || !item.quantity || item.quantity <= 0) {
          throw new ValidationError("Product ID and quantity (> 0) are required for all items");
        }
        if (item.purchase_price === undefined || item.purchase_price < 0) {
          throw new ValidationError("Purchase price must be greater than or equal to 0");
        }

        // Fetch & lock product details
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, item.product_id), eq(products.store_id, storeId)))
          .for("update");

        if (!product) {
          throw new NotFoundError(`Product ID ${item.product_id} not found in this store`);
        }

        const purchasePricePaise = Math.round(item.purchase_price * 100);
        const lineTotalPaise = purchasePricePaise * item.quantity;
        subtotalPaise += lineTotalPaise;

        // Weighted Average Cost calculation
        const currentStock = product.stock || 0;
        const currentAvgCost = product.average_cost || 0;
        const addedQty = item.quantity;
        let newAvgCost: number;

        if (currentStock <= 0 || currentAvgCost <= 0) {
          newAvgCost = purchasePricePaise;
        } else {
          newAvgCost = Math.round(
            (currentStock * currentAvgCost + addedQty * purchasePricePaise) / (currentStock + addedQty)
          );
        }

        const newStock = currentStock + addedQty;

        // Update product stock, purchase_price, average_cost, last_purchase_cost
        // (SELLING PRICE IS UNCHANGED PER REQUIREMENTS)
        await tx
          .update(products)
          .set({
            stock: newStock,
            purchase_price: purchasePricePaise,
            average_cost: newAvgCost,
            last_purchase_cost: purchasePricePaise,
            updated_at: new Date(),
          })
          .where(eq(products.id, item.product_id));

        // Audit Log 1: Inventory Movement
        await tx.insert(inventory_movements).values({
          store_id: storeId,
          movement_type: "PURCHASE",
          product_id: item.product_id,
          quantity: item.quantity,
          previous_stock: currentStock,
          new_stock: newStock,
          reference_type: "PURCHASE_ORDER",
          reference_id: poNumber,
          reason: `Purchase Entry: invoice ${invNumber || ""}`,
          created_by: "System",
        });

        // Audit Log 2: Legacy Inventory Log (backward compatibility)
        await tx.insert(inventory_logs).values({
          product_id: item.product_id,
          store_id: storeId,
          type: "PURCHASE",
          quantity: item.quantity,
          before_stock: currentStock,
          after_stock: newStock,
          reference: poNumber,
        });

        // Audit Log 3: Product Cost History
        await tx.insert(product_cost_history).values({
          store_id: storeId,
          product_id: item.product_id,
          average_cost: newAvgCost,
        });

        itemsData.push({
          product_id: item.product_id,
          quantity: item.quantity,
          received_quantity: item.quantity,
          purchase_price: purchasePricePaise,
          line_total: lineTotalPaise,
        });
      }

      // Convert header fields to paise
      const discountPaise = Math.round((data.discount || 0) * 100);
      const taxPaise = Math.round(((data.gst !== undefined ? data.gst : data.tax) || 0) * 100);
      const grandTotalPaise = subtotalPaise - discountPaise + taxPaise;

      // 3. Create PO via repository inside transaction
      const createdPo = await this.repository.create(
        {
          supplier_id: data.supplier_id,
          po_number: poNumber,
          purchase_number: poNumber,
          invoice_number: invNumber,
          supplier_invoice_number: invNumber,
          invoice_date: invDate,
          purchase_date: invDate,
          subtotal: subtotalPaise,
          discount: discountPaise,
          gst: taxPaise,
          tax: taxPaise,
          grand_total: grandTotalPaise,
          payment_status: data.payment_status || "Pending",
          notes: data.notes || null,
        },
        itemsData,
        tx
      );

      // 4. Update supplier balance & write ledger entry
      const newBalance = supplier.current_balance + grandTotalPaise;
      await tx
        .update(suppliers)
        .set({ current_balance: newBalance })
        .where(eq(suppliers.id, data.supplier_id));

      await tx.insert(supplier_ledger).values({
        store_id: storeId,
        supplier_id: data.supplier_id,
        transaction_type: "PURCHASE",
        amount: grandTotalPaise,
        balance: newBalance,
        reference: poNumber,
      });

      return createdPo;
    });
  }

  async getAll(params?: { q?: string; startDate?: string; endDate?: string }): Promise<any[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }
    return this.repository.getAll(params);
  }

  async getById(id: number): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const po = await this.repository.getById(id);
    if (!po) return null;

    const items = await this.repository.getItems(id);
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
      const oldPo = await this.repository.getById(id, tx);
      if (!oldPo) {
        throw new NotFoundError("Purchase order not found");
      }

      const oldItems = await this.repository.getItems(id, tx);

      // 2. REVERSAL PHASE: Revert stock for old items
      for (const oldItem of oldItems) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, oldItem.product_id), eq(products.store_id, storeId)))
          .for("update");

        if (product) {
          const currentStock = product.stock;
          const newStock = currentStock - oldItem.quantity;

          await tx
            .update(products)
            .set({ stock: newStock, updated_at: new Date() })
            .where(eq(products.id, oldItem.product_id));

          await tx.insert(inventory_movements).values({
            store_id: storeId,
            movement_type: "PURCHASE_CANCEL",
            product_id: oldItem.product_id,
            quantity: oldItem.quantity,
            previous_stock: currentStock,
            new_stock: newStock,
            reference_type: "PURCHASE_ORDER",
            reference_id: oldPo.po_number,
            reason: `Purchase Update Reversal: PO ${oldPo.po_number}`,
            created_by: "System",
          });

          await tx.insert(inventory_logs).values({
            product_id: oldItem.product_id,
            store_id: storeId,
            type: "PURCHASE_CANCEL",
            quantity: oldItem.quantity,
            before_stock: currentStock,
            after_stock: newStock,
            reference: oldPo.po_number,
          });
        }
      }

      // Delete old items
      await this.repository.deleteItems(id, tx);

      // 3. APPLY NEW ITEMS PHASE
      let subtotalPaise = 0;
      const newItemsData: any[] = [];

      for (const item of data.items) {
        if (!item.product_id || !item.quantity || item.quantity <= 0) {
          throw new ValidationError("Product ID and quantity (> 0) are required for all items");
        }
        if (item.purchase_price === undefined || item.purchase_price < 0) {
          throw new ValidationError("Purchase price must be greater than or equal to 0");
        }

        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, item.product_id), eq(products.store_id, storeId)))
          .for("update");

        if (!product) {
          throw new NotFoundError(`Product ID ${item.product_id} not found in this store`);
        }

        const purchasePricePaise = Math.round(item.purchase_price * 100);
        const lineTotalPaise = purchasePricePaise * item.quantity;
        subtotalPaise += lineTotalPaise;

        const currentStock = product.stock || 0;
        const currentAvgCost = product.average_cost || 0;
        const addedQty = item.quantity;
        let newAvgCost: number;

        if (currentStock <= 0 || currentAvgCost <= 0) {
          newAvgCost = purchasePricePaise;
        } else {
          newAvgCost = Math.round(
            (currentStock * currentAvgCost + addedQty * purchasePricePaise) / (currentStock + addedQty)
          );
        }

        const newStock = currentStock + addedQty;

        await tx
          .update(products)
          .set({
            stock: newStock,
            purchase_price: purchasePricePaise,
            average_cost: newAvgCost,
            last_purchase_cost: purchasePricePaise,
            updated_at: new Date(),
          })
          .where(eq(products.id, item.product_id));

        await tx.insert(inventory_movements).values({
          store_id: storeId,
          movement_type: "PURCHASE",
          product_id: item.product_id,
          quantity: item.quantity,
          previous_stock: currentStock,
          new_stock: newStock,
          reference_type: "PURCHASE_ORDER",
          reference_id: oldPo.po_number,
          reason: `Purchase Update Receipt: invoice ${data.supplier_invoice_number || ""}`,
          created_by: "System",
        });

        await tx.insert(inventory_logs).values({
          product_id: item.product_id,
          store_id: storeId,
          type: "PURCHASE",
          quantity: item.quantity,
          before_stock: currentStock,
          after_stock: newStock,
          reference: oldPo.po_number,
        });

        await tx.insert(product_cost_history).values({
          store_id: storeId,
          product_id: item.product_id,
          average_cost: newAvgCost,
        });

        newItemsData.push({
          purchase_order_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          purchase_price: purchasePricePaise,
          line_total: lineTotalPaise,
        });
      }

      // Convert header fields
      const discountPaise = Math.round((data.discount || 0) * 100);
      const taxPaise = Math.round(((data.gst !== undefined ? data.gst : data.tax) || 0) * 100);
      const grandTotalPaise = subtotalPaise - discountPaise + taxPaise;

      // Update PO and insert new items
      const updatedPo = await this.repository.update(
        id,
        {
          supplier_id: data.supplier_id,
          supplier_invoice_number: data.supplier_invoice_number || null,
          purchase_date: data.purchase_date || new Date().toISOString(),
          subtotal: subtotalPaise,
          discount: discountPaise,
          gst: taxPaise,
          tax: taxPaise,
          grand_total: grandTotalPaise,
          payment_status: data.payment_status || "Pending",
          notes: data.notes || null,
        },
        tx
      );

      await this.repository.insertItems(newItemsData, tx);

      // 4. Update supplier balance and ledger
      if (oldPo.supplier_id !== data.supplier_id) {
        // Revert old supplier
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

          await tx.insert(supplier_ledger).values({
            store_id: storeId,
            supplier_id: oldPo.supplier_id,
            transaction_type: "PURCHASE_CANCEL",
            amount: oldPo.grand_total,
            balance: newOldBal,
            reference: oldPo.po_number,
          });
        }

        // Add new supplier
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

        await tx.insert(supplier_ledger).values({
          store_id: storeId,
          supplier_id: data.supplier_id,
          transaction_type: "PURCHASE",
          amount: grandTotalPaise,
          balance: newNewBal,
          reference: oldPo.po_number,
        });
      } else {
        // Same supplier
        const [supplier] = await tx
          .select()
          .from(suppliers)
          .where(and(eq(suppliers.id, data.supplier_id), eq(suppliers.store_id, storeId)))
          .for("update");

        if (supplier) {
          const balanceDiff = grandTotalPaise - oldPo.grand_total;
          const newBal = supplier.current_balance + balanceDiff;
          await tx
            .update(suppliers)
            .set({ current_balance: newBal })
            .where(eq(suppliers.id, data.supplier_id));

          await tx.insert(supplier_ledger).values({
            store_id: storeId,
            supplier_id: data.supplier_id,
            transaction_type: "PURCHASE",
            amount: grandTotalPaise,
            balance: newBal,
            reference: oldPo.po_number,
          });
        }
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
      const oldPo = await this.repository.getById(id, tx);
      if (!oldPo) {
        throw new NotFoundError("Purchase order not found");
      }

      const oldItems = await this.repository.getItems(id, tx);

      // REVERSAL PHASE: Subtract stock adjustments
      for (const oldItem of oldItems) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, oldItem.product_id), eq(products.store_id, storeId)))
          .for("update");

        if (product) {
          const currentStock = product.stock;
          const newStock = currentStock - oldItem.quantity;

          await tx
            .update(products)
            .set({ stock: newStock, updated_at: new Date() })
            .where(eq(products.id, oldItem.product_id));

          await tx.insert(inventory_movements).values({
            store_id: storeId,
            movement_type: "PURCHASE_CANCEL",
            product_id: oldItem.product_id,
            quantity: oldItem.quantity,
            previous_stock: currentStock,
            new_stock: newStock,
            reference_type: "PURCHASE_ORDER",
            reference_id: oldPo.po_number,
            reason: `Purchase Deletion: PO ${oldPo.po_number}`,
            created_by: "System",
          });

          await tx.insert(inventory_logs).values({
            product_id: oldItem.product_id,
            store_id: storeId,
            type: "PURCHASE_CANCEL",
            quantity: oldItem.quantity,
            before_stock: currentStock,
            after_stock: newStock,
            reference: oldPo.po_number,
          });
        }
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

        await tx.insert(supplier_ledger).values({
          store_id: storeId,
          supplier_id: oldPo.supplier_id,
          transaction_type: "PURCHASE_CANCEL",
          amount: oldPo.grand_total,
          balance: newBalance,
          reference: oldPo.po_number,
        });
      }

      // Delete PO
      return this.repository.delete(id, tx);
    });
  }
}

export const purchaseV2Service = new PurchaseV2Service();
