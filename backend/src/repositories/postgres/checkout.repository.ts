import { ICheckoutRepository } from "../interfaces/ICheckoutRepository";
import { Sale, SaleItem } from "../../types/checkout.types";
import { db } from "../../db";
import { sales, sale_items } from "../../db/schema";
import crypto from "crypto";
import { getStoreId } from "../../db/context";

export class PostgresCheckoutRepository implements ICheckoutRepository {
  async createSale(sale: Omit<Sale, "id" | "created_at">, tx?: any): Promise<number> {
    const client = tx || db;
    const storeId = getStoreId() || 1;
    const publicToken = crypto.randomBytes(9).toString("base64url").substring(0, 12);
    const [created] = await client
      .insert(sales)
      .values({
        store_id: storeId,
        invoice_number: sale.invoice_number,
        customer_id: sale.customer_id,
        cashier_name: sale.cashier_name,
        payment_method: sale.payment_method,
        payment_details: (sale as any).payment_details ?? null,
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        grand_total: sale.grand_total,
        paid_amount: (sale as any).paid_amount ?? sale.grand_total,
        balance: (sale as any).balance ?? 0,
        public_token: publicToken,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert sale record");
    }
    return created.id;
  }

  async createSaleItem(item: Omit<SaleItem, "id">, tx?: any): Promise<void> {
    const client = tx || db;
    await client
      .insert(sale_items)
      .values({
        sale_id: item.sale_id,
        product_id: item.product_id,
        quantity: item.quantity,
        selling_price: item.selling_price,
        discount: item.discount,
        line_total: item.line_total,
      });
  }
}
