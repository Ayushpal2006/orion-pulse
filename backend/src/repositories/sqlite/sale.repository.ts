import { ISaleRepository } from "../interfaces/ISaleRepository";
import { Sale } from "../../types/checkout.types";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";

export class SQLiteSaleRepository implements ISaleRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  async getAll(tx?: DatabaseAdapter): Promise<Sale[]> {
    const client = tx || this.db;
    return client.query<Sale>("SELECT * FROM sales ORDER BY id DESC");
  }

  async getById(id: number, tx?: DatabaseAdapter): Promise<Sale | null> {
    const client = tx || this.db;
    return client.queryOne<Sale>("SELECT * FROM sales WHERE id = ?", [id]);
  }

  async getByInvoice(invoice: string, tx?: DatabaseAdapter): Promise<Sale | null> {
    const client = tx || this.db;
    return client.queryOne<Sale>("SELECT * FROM sales WHERE invoice_number = ?", [invoice]);
  }

  async getTodaySales(tx?: DatabaseAdapter): Promise<Sale[]> {
    const client = tx || this.db;
    return client.query<Sale>(`
      SELECT * FROM sales 
      WHERE date(created_at, '+5 hours', '30 minutes') = date('now', '+5 hours', '30 minutes') 
      ORDER BY id DESC
    `);
  }

  async getSaleItems(saleId: number, tx?: DatabaseAdapter): Promise<any[]> {
    const client = tx || this.db;
    return client.query(`
      SELECT si.*, p.name as product_name, p.sku as product_sku, p.gst as product_gst
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
      ORDER BY si.id ASC
    `, [saleId]);
  }

  async getByCustomerPhone(phone: string, tx?: DatabaseAdapter): Promise<Sale[]> {
    const client = tx || this.db;
    return client.query<Sale>(`
      SELECT s.*
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE c.phone = ?
      ORDER BY s.id DESC
    `, [phone]);
  }

  async getLastInvoiceNumber(tx?: DatabaseAdapter): Promise<string | null> {
    const client = tx || this.db;
    const row = await client.queryOne<{ invoice_number: string }>(
      "SELECT invoice_number FROM sales ORDER BY id DESC LIMIT 1"
    );
    return row ? row.invoice_number : null;
  }

  async updatePdfUrlByInvoice(invoiceNumber: string, pdfUrl: string, tx?: DatabaseAdapter): Promise<boolean> {
    const client = tx || this.db;
    const result = await client.execute(
      "UPDATE sales SET pdf_url = ? WHERE invoice_number = ?",
      [pdfUrl, invoiceNumber]
    );
    return result.changes > 0;
  }

  async getByPublicToken(token: string, tx?: DatabaseAdapter): Promise<Sale | null> {
    const client = tx || this.db;
    return client.queryOne<Sale>("SELECT * FROM sales WHERE public_token = ?", [token]);
  }

  async getSalesExport(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<any[]> {
    const client = tx || this.db;
    let clause = "1=1";
    const params: any = {};

    switch (filter) {
      case "today":
        clause = "date(created_at) = date('now')";
        break;
      case "yesterday":
        clause = "date(created_at) = date('now', '-1 day')";
        break;
      case "last7":
        clause = "date(created_at) >= date('now', '-6 days')";
        break;
      case "last30":
        clause = "date(created_at) >= date('now', '-29 days')";
        break;
      case "thisMonth":
        clause = "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')";
        break;
      case "lastMonth":
        clause = "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')";
        break;
      case "thisYear":
        clause = "strftime('%Y', created_at) = strftime('%Y', 'now')";
        break;
      case "custom":
        if (startDate) {
          const actualEnd = endDate || startDate;
          clause = "date(created_at) >= date($startDate) AND date(created_at) <= date($endDate)";
          params.startDate = startDate;
          params.endDate = actualEnd;
        }
        break;
    }

    return client.query(`
      SELECT invoice_number as Invoice, 
             created_at as Date, 
             cashier_name as Cashier, 
             payment_method as Payment, 
             subtotal/100.0 as Subtotal, 
             discount/100.0 as Discount, 
             gst/100.0 as GST, 
             grand_total/100.0 as Total,
             public_token as PublicToken
      FROM sales
      WHERE ${clause}
      ORDER BY id DESC
    `, params);
  }
}
