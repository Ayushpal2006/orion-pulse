import { IDashboardRepository } from "../interfaces/IDashboardRepository";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";

export class PostgresDashboardRepository implements IDashboardRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  async getTodaySummary(tx?: DatabaseAdapter): Promise<{
    todayRevenue: number;
    todayOrders: number;
    todayProfit: number;
    inventoryCount: number;
    lowStockCount: number;
  }> {
    const client = tx || this.db;

    // 1. Revenue Today
    const revRow = await client.queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(grand_total), 0) as total 
      FROM sales 
      WHERE timezone('Asia/Kolkata', created_at)::date = timezone('Asia/Kolkata', now())::date
    `);
    const revenue = revRow ? Number(revRow.total) : 0;

    // 2. Orders Today
    const orderRow = await client.queryOne<{ count: string | number }>(`
      SELECT COUNT(*) as count 
      FROM sales 
      WHERE timezone('Asia/Kolkata', created_at)::date = timezone('Asia/Kolkata', now())::date
    `);
    const orders = Number(orderRow ? orderRow.count : 0);

    // 3. Profit Today
    const profitRow = await client.queryOne<{ profit: number }>(`
      SELECT COALESCE(SUM(si.line_total - (p.purchase_price * si.quantity)), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE timezone('Asia/Kolkata', s.created_at)::date = timezone('Asia/Kolkata', now())::date
    `);
    const profit = profitRow ? Number(profitRow.profit) : 0;

    // 4. Inventory Count
    const invRow = await client.queryOne<{ count: string | number }>(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE is_active = 1
    `);
    const inventoryCount = Number(invRow ? invRow.count : 0);

    // 5. Low Stock Count
    const lowStockRow = await client.queryOne<{ count: string | number }>(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE is_active = 1 AND stock <= minimum_stock
    `);
    const lowStockCount = Number(lowStockRow ? lowStockRow.count : 0);

    return {
      todayRevenue: revenue / 100.0,
      todayOrders: orders,
      todayProfit: profit / 100.0,
      inventoryCount,
      lowStockCount,
    };
  }

  async getTopProducts(tx?: DatabaseAdapter): Promise<any[]> {
    const client = tx || this.db;
    const rows = await client.query<{ name: string; unitssold: string | number; revenue: string | number }>(`
      SELECT p.name, SUM(si.quantity) as unitsSold, SUM(si.line_total) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      GROUP BY p.name, si.product_id
      ORDER BY unitsSold DESC
      LIMIT 10
    `);
    return rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      unitsSold: Number(r.unitssold),
      revenue: Number(r.revenue) / 100.0,
    }));
  }

  async getRecentSales(tx?: DatabaseAdapter): Promise<any[]> {
    const client = tx || this.db;
    const rows = await client.query<{
      invoicenumber: string;
      customer: string;
      amount: string | number;
      payment: string;
      time: any;
    }>(`
      SELECT s.invoice_number as invoiceNumber,
             COALESCE(c.name, 'Walk-in') as customer,
             s.grand_total as amount,
             s.payment_method as payment,
             s.created_at as time
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC
      LIMIT 10
    `);

    return rows.map((r) => ({
      invoiceNumber: r.invoicenumber,
      customer: r.customer,
      amount: Number(r.amount) / 100.0,
      payment: r.payment,
      time: r.time,
    }));
  }
}
