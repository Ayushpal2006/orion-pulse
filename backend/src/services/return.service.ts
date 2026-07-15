import { db } from "../db";
import { sales, sale_items, returns, return_items, products, inventory_logs } from "../db/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { NotFoundError, ValidationError } from "../utils/errors";
import { getKolkataDateString } from "../utils/datetime";

export class ReturnService {
  async generateNextReturnNumber(storeId: number, txClient?: any): Promise<string> {
    const client = txClient || db;
    const todayStr = getKolkataDateString();
    const prefix = `RET-${todayStr}-`;

    const rows = await client
      .select({ return_invoice_number: returns.return_invoice_number })
      .from(returns)
      .where(and(eq(returns.store_id, storeId), like(returns.return_invoice_number, `${prefix}%`)))
      .orderBy(desc(returns.id))
      .limit(1);

    let nextSeq = 1;
    if (rows[0]) {
      const parts = rows[0].return_invoice_number.split("-");
      if (parts.length === 3) {
        const seqNum = parseInt(parts[2], 10);
        if (!isNaN(seqNum)) {
          nextSeq = seqNum + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, "0")}`;
  }

  async processReturn(saleId: number, items: { productId: number; quantity: number }[]): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError("Items to return are required");
    }

    const result = await db.transaction(async (tx) => {
      // 1. Verify original sale exists
      const [sale] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, saleId), eq(sales.store_id, storeId)))
        .limit(1);

      if (!sale) {
        throw new NotFoundError(`Sale with ID ${saleId} not found`);
      }

      // 2. Fetch original sale items
      const originalItems = await tx
        .select()
        .from(sale_items)
        .where(eq(sale_items.sale_id, saleId));

      // 3. Fetch all previous returns for this sale to compute already returned quantities
      const previousReturns = await tx
        .select({
          productId: return_items.product_id,
          returnedQty: sql<string>`SUM(${return_items.quantity})`,
        })
        .from(return_items)
        .innerJoin(returns, eq(return_items.return_id, returns.id))
        .where(eq(returns.original_sale_id, saleId))
        .groupBy(return_items.product_id);

      const previousReturnMap = new Map<number, number>();
      for (const pr of previousReturns) {
        previousReturnMap.set(pr.productId, Number(pr.returnedQty || 0));
      }

      const returnInvoiceNumber = await this.generateNextReturnNumber(storeId, tx);

      const syncProductsList: any[] = [];
      let returnSubtotal = 0;
      let returnGst = 0;
      let returnGrandTotal = 0;

      const returnDetails: {
        productId: number;
        quantity: number;
        sellingPrice: number;
        refundAmount: number;
      }[] = [];

      // 4. Validate and calculate each returned item
      for (const retItem of items) {
        const origItem = originalItems.find((oi) => oi.product_id === retItem.productId);
        if (!origItem) {
          throw new ValidationError(`Product ID ${retItem.productId} was not part of the original sale`);
        }

        const prevReturned = previousReturnMap.get(retItem.productId) || 0;
        const maxReturnable = origItem.quantity - prevReturned;
        if (retItem.quantity > maxReturnable) {
          throw new ValidationError(`Cannot return ${retItem.quantity} units of product ID ${retItem.productId}. Maximum returnable is ${maxReturnable}`);
        }

        // Calculate item unit pricing, unit discount, and unit gst
        const unitPrice = origItem.selling_price;
        const unitDiscount = Math.round(origItem.discount / origItem.quantity);
        const unitGst = Math.round(
          ((origItem.selling_price * origItem.quantity - origItem.discount) * 0.18) / origItem.quantity
        ); // Defaulting to original pricing details
        
        const lineTotal = (unitPrice - unitDiscount + unitGst) * retItem.quantity;

        returnSubtotal += unitPrice * retItem.quantity;
        returnGst += unitGst * retItem.quantity;
        returnGrandTotal += lineTotal;

        returnDetails.push({
          productId: retItem.productId,
          quantity: retItem.quantity,
          sellingPrice: unitPrice,
          refundAmount: lineTotal,
        });

        // 5. Update product stock (increase stock by returned quantity)
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, retItem.productId))
          .limit(1);

        if (product) {
          const beforeStock = product.stock;
          const afterStock = beforeStock + retItem.quantity;

          const [updatedProduct] = await tx
            .update(products)
            .set({ stock: afterStock, updated_at: new Date() })
            .where(eq(products.id, retItem.productId))
            .returning();

          if (updatedProduct) {
            syncProductsList.push({
              ...updatedProduct,
              created_at: updatedProduct.created_at.toISOString(),
              updated_at: updatedProduct.updated_at.toISOString()
            });
          }

          // Log inventory movement (RETURN type)
          await tx.insert(inventory_logs).values({
            product_id: retItem.productId,
            store_id: storeId,
            type: "RETURN",
            quantity: retItem.quantity,
            before_stock: beforeStock,
            after_stock: afterStock,
            reference: returnInvoiceNumber,
          });
        }
      }

      // 6. Insert Return header record
      const [returnHeader] = await tx
        .insert(returns)
        .values({
          store_id: storeId,
          original_sale_id: saleId,
          return_invoice_number: returnInvoiceNumber,
          subtotal: returnSubtotal,
          discount: 0, // Returns do not support extra cart discounts by default
          gst: returnGst,
          grand_total: returnGrandTotal,
        })
        .returning();

      // 7. Insert Return items
      for (const detail of returnDetails) {
        await tx.insert(return_items).values({
          return_id: returnHeader.id,
          product_id: detail.productId,
          quantity: detail.quantity,
          selling_price: detail.sellingPrice,
          refund_amount: detail.refundAmount,
        });
      }

      return {
        returnInvoiceNumber,
        returnHeader,
        items: returnDetails,
        syncProductsList,
      };
    });

    if (result.syncProductsList && Array.isArray(result.syncProductsList)) {
      try {
        const { SyncQueueManager } = require("./sync.service");
        for (const prod of result.syncProductsList) {
          SyncQueueManager.getInstance().enqueue("product", prod);
        }
      } catch (e) {}
    }

    return {
      returnInvoiceNumber: result.returnInvoiceNumber,
      returnHeader: result.returnHeader,
      items: result.items,
    };
  }

  async getReturnsBySaleId(saleId: number): Promise<any[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const rows = await db
      .select({
        id: returns.id,
        return_invoice_number: returns.return_invoice_number,
        subtotal: returns.subtotal,
        gst: returns.gst,
        grand_total: returns.grand_total,
        created_at: returns.created_at,
      })
      .from(returns)
      .where(and(eq(returns.original_sale_id, saleId), eq(returns.store_id, storeId)))
      .orderBy(desc(returns.id));

    return rows;
  }
}
