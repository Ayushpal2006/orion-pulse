import db from "../database/db";
import { Sale, SaleItem } from "../types/checkout.types";
import crypto from "crypto";

export class CheckoutRepository {
  createSale(sale: Omit<Sale, "id" | "created_at">): number {
    const publicToken = crypto.randomBytes(9).toString("base64url").substring(0, 12);
    const stmt = db.prepare(`
      INSERT INTO sales (
        invoice_number, customer_id, cashier_name, payment_method, subtotal, discount, gst, grand_total, public_token
      ) VALUES (
        @invoice_number, @customer_id, @cashier_name, @payment_method, @subtotal, @discount, @gst, @grand_total, @public_token
      )
    `);

    const result = stmt.run({
      invoice_number: sale.invoice_number,
      customer_id: sale.customer_id,
      cashier_name: sale.cashier_name,
      payment_method: sale.payment_method,
      subtotal: sale.subtotal,
      discount: sale.discount,
      gst: sale.gst,
      grand_total: sale.grand_total,
      public_token: publicToken,
    });

    return Number(result.lastInsertRowid);
  }

  createSaleItem(item: Omit<SaleItem, "id">): void {
    const stmt = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, quantity, selling_price, discount, line_total
      ) VALUES (
        @sale_id, @product_id, @quantity, @selling_price, @discount, @line_total
      )
    `);

    stmt.run({
      sale_id: item.sale_id,
      product_id: item.product_id,
      quantity: item.quantity,
      selling_price: item.selling_price,
      discount: item.discount,
      line_total: item.line_total,
    });
  }
}
