import { ICheckoutRepository } from "../interfaces/ICheckoutRepository";
import { Sale, SaleItem } from "../../types/checkout.types";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";
import crypto from "crypto";

export class SQLiteCheckoutRepository implements ICheckoutRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  async createSale(sale: Omit<Sale, "id" | "created_at">, tx?: DatabaseAdapter): Promise<number> {
    const client = tx || this.db;
    const publicToken = crypto.randomBytes(9).toString("base64url").substring(0, 12);
    const result = await client.execute(`
      INSERT INTO sales (
        invoice_number, customer_id, cashier_name, payment_method, subtotal, discount, gst, grand_total, public_token
      ) VALUES (
        @invoice_number, @customer_id, @cashier_name, @payment_method, @subtotal, @discount, @gst, @grand_total, @public_token
      )
    `, {
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

    return Number(result.lastInsertId);
  }

  async createSaleItem(item: Omit<SaleItem, "id">, tx?: DatabaseAdapter): Promise<void> {
    const client = tx || this.db;
    await client.execute(`
      INSERT INTO sale_items (
        sale_id, product_id, quantity, selling_price, discount, line_total
      ) VALUES (
        @sale_id, @product_id, @quantity, @selling_price, @discount, @line_total
      )
    `, {
      sale_id: item.sale_id,
      product_id: item.product_id,
      quantity: item.quantity,
      selling_price: item.selling_price,
      discount: item.discount,
      line_total: item.line_total,
    });
  }
}
