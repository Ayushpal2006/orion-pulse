import { db } from "../db";
import { purchase_orders, purchase_items, products, inventory_logs, suppliers, supplier_ledger } from "../db/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { NotFoundError, ValidationError } from "../utils/errors";

export class PurchaseService {
  async generateNextPONumber(storeId: number, txClient?: any): Promise<string> {
    const client = txClient || db;
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // "20260713"
    const prefix = `PO-${todayStr}-`;

    const rows = await client
      .select({ po_number: purchase_orders.po_number })
      .from(purchase_orders)
      .where(and(eq(purchase_orders.store_id, storeId), like(purchase_orders.po_number, `${prefix}%`)))
      .orderBy(desc(purchase_orders.id))
      .limit(1);

    let nextSeq = 1;
    if (rows[0]) {
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

    if (!data.supplier_id || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new ValidationError("Supplier ID and a list of items are required");
    }

    return db.transaction(async (tx) => {
      // Verify supplier
      const [supplier] = await tx
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, data.supplier_id), eq(suppliers.store_id, storeId)))
        .limit(1);

      if (!supplier) {
        throw new NotFoundError("Supplier not found");
      }

      const poNumber = await this.generateNextPONumber(storeId, tx);

      let subtotal = 0;
      let totalGst = 0;
      let totalDiscount = 0;

      // 1. Insert PO base record
      const [po] = await tx
        .insert(purchase_orders)
        .values({
          store_id: storeId,
          supplier_id: data.supplier_id,
          po_number: poNumber,
          status: "Draft",
          expected_delivery: data.expected_delivery ? new Date(data.expected_delivery) : null,
          subtotal: 0,
          discount: 0,
          gst: 0,
          grand_total: 0,
          net_amount: 0,
          payment_status: "Unpaid",
          notes: data.notes ?? null,
        })
        .returning();

      // 2. Insert PO items and calculate totals
      for (const item of data.items) {
        if (!item.product_id || !item.quantity || item.quantity <= 0 || !item.purchase_price) {
          throw new ValidationError("Invalid product item specifications");
        }

        // Verify product
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, item.product_id), eq(products.store_id, storeId)))
          .limit(1);

        if (!product) {
          throw new NotFoundError(`Product ID ${item.product_id} not found`);
        }

        const itemSubtotal = item.purchase_price * item.quantity;
        const itemDiscount = item.discount ?? 0;
        const itemGst = Math.round((itemSubtotal - itemDiscount) * (product.gst / 100.0));
        const lineTotal = itemSubtotal - itemDiscount + itemGst;

        subtotal += itemSubtotal;
        totalDiscount += itemDiscount;
        totalGst += itemGst;

        await tx.insert(purchase_items).values({
          purchase_order_id: po.id,
          product_id: item.product_id,
          quantity: item.quantity,
          received_quantity: 0,
          purchase_price: item.purchase_price,
          discount: itemDiscount,
          gst: itemGst,
          line_total: lineTotal,
        });
      }

      const grandTotal = subtotal - totalDiscount + totalGst;

      // 3. Update PO totals
      const [updatedPo] = await tx
        .update(purchase_orders)
        .set({
          subtotal,
          discount: totalDiscount,
          gst: totalGst,
          grand_total: grandTotal,
          net_amount: grandTotal,
        })
        .where(eq(purchase_orders.id, po.id))
        .returning();

      return updatedPo;
    });
  }

  async getById(id: number): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const [po] = await db
      .select()
      .from(purchase_orders)
      .where(and(eq(purchase_orders.id, id), eq(purchase_orders.store_id, storeId)))
      .limit(1);

    if (!po) return null;

    const items = await db
      .select({
        id: purchase_items.id,
        product_id: purchase_items.product_id,
        quantity: purchase_items.quantity,
        received_quantity: purchase_items.received_quantity,
        purchase_price: purchase_items.purchase_price,
        discount: purchase_items.discount,
        gst: purchase_items.gst,
        line_total: purchase_items.line_total,
        product_name: products.name,
        product_sku: products.sku,
      })
      .from(purchase_items)
      .innerJoin(products, eq(purchase_items.product_id, products.id))
      .where(eq(purchase_items.purchase_order_id, po.id));

    return { ...po, items };
  }

  async receiveGoods(id: number, receivedItems: { productId: number; receivedQty: number }[], invoiceDetails: any): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    return db.transaction(async (tx) => {
      // 1. Fetch PO details
      const [po] = await tx
        .select()
        .from(purchase_orders)
        .where(and(eq(purchase_orders.id, id), eq(purchase_orders.store_id, storeId)))
        .limit(1);

      if (!po) {
        throw new NotFoundError(`Purchase order with ID ${id} not found`);
      }

      if (po.status === "Received" || po.status === "Cancelled") {
        throw new ValidationError(`Purchase order is already in "${po.status}" state`);
      }

      // 2. Fetch current items of the PO
      const poItems = await tx
        .select()
        .from(purchase_items)
        .where(eq(purchase_items.purchase_order_id, po.id));

      let totalReceivedCost = 0;
      let hasPendingItems = false;

      // 3. Process goods receiving item-by-item
      for (const item of poItems) {
        const inputItem = receivedItems.find((i) => i.productId === item.product_id);
        const qtyToReceive = inputItem ? inputItem.receivedQty : 0;

        const maxReceivable = item.quantity - item.received_quantity;
        if (qtyToReceive > maxReceivable) {
          throw new ValidationError(`Cannot receive ${qtyToReceive} units of product ID ${item.product_id}. Maximum receivable is ${maxReceivable}`);
        }

        const newReceivedQty = item.received_quantity + qtyToReceive;
        if (newReceivedQty < item.quantity) {
          hasPendingItems = true;
        }

        // Calculate fraction of discount and gst for the received quantity
        const unitPurchasePrice = item.purchase_price;
        const unitDiscount = Math.round(item.discount / item.quantity);
        const unitGst = Math.round(item.gst / item.quantity);
        const receivedLineTotal = (unitPurchasePrice - unitDiscount + unitGst) * qtyToReceive;
        totalReceivedCost += receivedLineTotal;

        // Update item received quantity
        await tx
          .update(purchase_items)
          .set({ received_quantity: newReceivedQty })
          .where(eq(purchase_items.id, item.id));

        if (qtyToReceive > 0) {
          // Fetch product
          const [product] = await tx
            .select()
            .from(products)
            .where(eq(products.id, item.product_id))
            .limit(1);

          if (!product) {
            throw new NotFoundError(`Product ID ${item.product_id} no longer exists`);
          }

          const beforeStock = product.stock;
          const afterStock = beforeStock + qtyToReceive;

          // Average purchase cost calculation
          let averageCost = product.average_cost;
          if (averageCost <= 0) {
            averageCost = product.purchase_price;
          }
          const totalCostBefore = beforeStock * averageCost;
          const totalCostAdded = qtyToReceive * item.purchase_price;
          const newAverageCost = afterStock > 0 ? Math.round((totalCostBefore + totalCostAdded) / afterStock) : item.purchase_price;

          // Calculate margin/markup percent with the new purchase price
          const margin = product.selling_price > 0 ? Math.round(((product.selling_price - item.purchase_price) / product.selling_price) * 100) : 0;
          const markup = item.purchase_price > 0 ? Math.round(((product.selling_price - item.purchase_price) / item.purchase_price) * 100) : 0;

          // Update product stock and costing
          await tx
            .update(products)
            .set({
              stock: afterStock,
              average_cost: newAverageCost,
              last_purchase_cost: item.purchase_price,
              margin_percent: margin,
              markup_percent: markup,
              updated_at: new Date(),
            })
            .where(eq(products.id, item.product_id));

          // Log inventory transaction (PURCHASE type)
          await tx.insert(inventory_logs).values({
            product_id: item.product_id,
            store_id: storeId,
            type: "PURCHASE",
            quantity: qtyToReceive,
            before_stock: beforeStock,
            after_stock: afterStock,
            reference: po.po_number,
          });
        }
      }

      const otherCharges = invoiceDetails.other_charges ?? 0;
      const transportCharges = invoiceDetails.transport_charges ?? 0;
      const totalOutstanding = totalReceivedCost + otherCharges + transportCharges;

      const nextStatus = hasPendingItems ? "Partially Received" : "Received";

      // 4. Update PO invoice and status
      const [updatedPo] = await tx
        .update(purchase_orders)
        .set({
          status: nextStatus,
          invoice_number: invoiceDetails.invoice_number ?? po.invoice_number,
          invoice_date: invoiceDetails.invoice_date ? new Date(invoiceDetails.invoice_date) : po.invoice_date,
          other_charges: otherCharges,
          transport_charges: transportCharges,
          net_amount: po.grand_total + otherCharges + transportCharges,
          updated_at: new Date(),
        })
        .where(eq(purchase_orders.id, po.id))
        .returning();

      // 5. Update supplier ledger & outstanding balance if we actually received something
      if (totalOutstanding > 0) {
        const [supplier] = await tx
          .select()
          .from(suppliers)
          .where(eq(suppliers.id, po.supplier_id))
          .limit(1);

        if (supplier) {
          const newBalance = supplier.current_balance + totalOutstanding;

          await tx
            .update(suppliers)
            .set({ current_balance: newBalance, updated_at: new Date() })
            .where(eq(suppliers.id, po.supplier_id));

          await tx.insert(supplier_ledger).values({
            store_id: storeId,
            supplier_id: po.supplier_id,
            transaction_type: "PURCHASE",
            amount: totalOutstanding, // Credit to ledger (increases outstanding balance)
            balance: newBalance,
            reference: po.po_number,
          });
        }
      }

      return updatedPo;
    });
  }

  async getAll(): Promise<any[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    return db
      .select({
        id: purchase_orders.id,
        po_number: purchase_orders.po_number,
        status: purchase_orders.status,
        expected_delivery: purchase_orders.expected_delivery,
        subtotal: purchase_orders.subtotal,
        discount: purchase_orders.discount,
        gst: purchase_orders.gst,
        grand_total: purchase_orders.grand_total,
        invoice_number: purchase_orders.invoice_number,
        payment_status: purchase_orders.payment_status,
        created_at: purchase_orders.created_at,
        supplier_name: suppliers.company_name,
      })
      .from(purchase_orders)
      .innerJoin(suppliers, eq(purchase_orders.supplier_id, suppliers.id))
      .where(eq(purchase_orders.store_id, storeId))
      .orderBy(desc(purchase_orders.id));
  }
}
