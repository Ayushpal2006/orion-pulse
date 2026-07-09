import db from "../database/db";

export class DashboardRepository {
  getTodaySummary() {
    // 1. Revenue Today (Coalesce returns 0 if no sales)
    const revStmt = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as total 
      FROM sales 
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `);
    const revenue = (revStmt.get() as { total: number }).total;

    // 2. Orders Today
    const orderStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM sales 
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `);
    const orders = (orderStmt.get() as { count: number }).count;

    // 3. Profit Today
    const profitStmt = db.prepare(`
      SELECT COALESCE(SUM(si.line_total - (p.purchase_price * si.quantity)), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE date(s.created_at, 'localtime') = date('now', 'localtime')
    `);
    const profit = (profitStmt.get() as { profit: number }).profit;

    // 4. Inventory Count (Active products)
    const invStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE is_active = 1
    `);
    const inventoryCount = (invStmt.get() as { count: number }).count;

    // 5. Low Stock Count
    const lowStockStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE is_active = 1 AND stock <= minimum_stock
    `);
    const lowStockCount = (lowStockStmt.get() as { count: number }).count;

    return {
      todayRevenue: revenue / 100.0, // convert paise to Rupees
      todayOrders: orders,
      todayProfit: profit / 100.0,    // convert paise to Rupees
      inventoryCount,
      lowStockCount,
    };
  }

  getTopProducts() {
    const stmt = db.prepare(`
      SELECT p.name, SUM(si.quantity) as unitsSold, SUM(si.line_total) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      GROUP BY si.product_id
      ORDER BY unitsSold DESC
      LIMIT 10
    `);
    const rows = stmt.all() as { name: string; unitsSold: number; revenue: number }[];
    return rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      unitsSold: r.unitsSold,
      revenue: r.revenue / 100.0, // convert paise to Rupees
    }));
  }

  getRecentSales() {
    const stmt = db.prepare(`
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
    const rows = stmt.all() as {
      invoiceNumber: string;
      customer: string;
      amount: number;
      payment: string;
      time: string;
    }[];

    return rows.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      customer: r.customer,
      amount: r.amount / 100.0, // convert paise to Rupees
      payment: r.payment,
      time: r.time,
    }));
  }
}
