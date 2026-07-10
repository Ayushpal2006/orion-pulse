import db from "../database/db";
import { Sale } from "../types/checkout.types";

export class SaleRepository {
  getAll(): Sale[] {
    const stmt = db.prepare("SELECT * FROM sales ORDER BY id DESC");
    return stmt.all() as Sale[];
  }

  getById(id: number): Sale | null {
    const stmt = db.prepare("SELECT * FROM sales WHERE id = ?");
    const result = stmt.get(id);
    return (result as Sale) || null;
  }

  getByInvoice(invoice: string): Sale | null {
    const stmt = db.prepare("SELECT * FROM sales WHERE invoice_number = ?");
    const result = stmt.get(invoice);
    return (result as Sale) || null;
  }

  getTodaySales(): Sale[] {
    // Queries sales where transaction date in local time equals local date today
    const stmt = db.prepare(`
      SELECT * FROM sales 
      WHERE date(created_at, '+5 hours', '30 minutes') = date('now', '+5 hours', '30 minutes') 
      ORDER BY id DESC
    `);
    return stmt.all() as Sale[];
  }

  getSaleItems(saleId: number): any[] {
    const stmt = db.prepare(`
      SELECT si.*, p.name as product_name, p.sku as product_sku, p.gst as product_gst
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
      ORDER BY si.id ASC
    `);
    return stmt.all(saleId);
  }

  getByCustomerPhone(phone: string): Sale[] {
    const stmt = db.prepare(`
      SELECT s.*
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE c.phone = ?
      ORDER BY s.id DESC
    `);
    return stmt.all(phone) as Sale[];
  }
}
