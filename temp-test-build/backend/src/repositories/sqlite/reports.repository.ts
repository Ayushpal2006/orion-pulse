import { IReportsRepository } from "../interfaces/IReportsRepository";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";
import { formatToKolkataDateTime } from "../../utils/datetime";

export class SQLiteReportsRepository implements IReportsRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  private getDateCondition(filter: string, startDate?: string, endDate?: string) {
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
    return { clause, params };
  }

  async getSummary(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<{
    revenue: number;
    orders: number;
    profit: number;
    averageOrderValue: number;
  }> {
    const client = tx || this.db;
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    // 1. Revenue
    const revRow = await client.queryOne<{ total: number }>(`
      SELECT COALESCE(SUM(grand_total), 0) as total 
      FROM sales 
      WHERE ${clause}
    `, params);
    const revenue = revRow ? revRow.total : 0;

    // 2. Orders
    const orderRow = await client.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM sales 
      WHERE ${clause}
    `, params);
    const orders = orderRow ? orderRow.count : 0;

    // 3. Profit
    const profitRow = await client.queryOne<{ profit: number }>(`
      SELECT COALESCE(SUM(si.line_total - (p.purchase_price * si.quantity)), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
    `, params);
    const profit = profitRow ? profitRow.profit : 0;

    return {
      revenue: revenue / 100.0,
      orders,
      profit: profit / 100.0,
      averageOrderValue: orders > 0 ? (revenue / orders) / 100.0 : 0,
    };
  }

  async getTopProducts(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<any[]> {
    const client = tx || this.db;
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    const rows = await client.query<{ name: string; unitsSold: number; revenue: number }>(`
      SELECT p.name, SUM(si.quantity) as unitsSold, SUM(si.line_total) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY si.product_id
      ORDER BY unitsSold DESC
      LIMIT 10
    `, params);

    return rows.map((r) => ({
      name: r.name,
      unitsSold: r.unitsSold,
      revenue: r.revenue / 100.0,
    }));
  }

  async getGstSummary(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<any[]> {
    const client = tx || this.db;
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    const rows = await client.query<{ slab: number; taxable: number; tax: number }>(`
      SELECT p.gst as slab,
             SUM(si.line_total) as taxable,
             SUM(si.line_total * p.gst / 100.0) as tax
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY p.gst
      ORDER BY p.gst ASC
    `, params);

    return rows.map((r) => ({
      slab: `${r.slab}%`,
      taxable: r.taxable / 100.0,
      tax: Math.round(r.tax) / 100.0,
    }));
  }

  async getPaymentSplit(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<Record<string, number>> {
    const client = tx || this.db;
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    const rows = await client.query<{ paymentMethod: string; amount: number }>(`
      SELECT payment_method as paymentMethod, SUM(grand_total) as amount
      FROM sales
      WHERE ${clause}
      GROUP BY payment_method
    `, params);

    const result: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Wallet: 0 };
    for (const r of rows) {
      result[r.paymentMethod] = r.amount / 100.0;
    }
    return result;
  }

  async getTrendSeries(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<any[]> {
    const client = tx || this.db;
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    if (filter === "today" || filter === "yesterday") {
      const rows = await client.query<{ hr: string; amount: number }>(`
        SELECT strftime('%H', datetime(created_at, '+5 hours', '30 minutes')) as hr, SUM(grand_total) as amount
        FROM sales
        WHERE ${clause}
        GROUP BY hr
        ORDER BY hr ASC
      `, params);

      const profitRows = await client.query<{ hr: string; profit: number }>(`
        SELECT strftime('%H', datetime(s.created_at, '+5 hours', '30 minutes')) as hr,
               SUM(si.line_total - (p.purchase_price * si.quantity)) as profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE ${clause.replace(/created_at/g, "s.created_at")}
        GROUP BY hr
      `, params);

      const profitMap = new Map<number, number>();
      for (const pr of profitRows) {
        profitMap.set(parseInt(pr.hr, 10), pr.profit / 100.0);
      }

      const hoursMap = new Map<number, number>();
      for (let h = 9; h <= 18; h++) {
        hoursMap.set(h, 0);
      }
      for (const r of rows) {
        const hourNum = parseInt(r.hr, 10);
        hoursMap.set(hourNum, r.amount / 100.0);
      }

      const formatHourLabel = (h: number): string => {
        if (h === 0) return "12a";
        if (h < 12) return `${h}a`;
        if (h === 12) return "12p";
        return `${h - 12}p`;
      };

      const sortedHours = Array.from(hoursMap.keys()).sort((a, b) => a - b);
      return sortedHours.map((h) => ({
        label: formatHourLabel(h),
        value: hoursMap.get(h) || 0,
        profit: profitMap.get(h) || 0,
      }));
    }

    if (filter === "thisYear") {
      const rows = await client.query<{ mnth: string; amount: number }>(`
        SELECT strftime('%m', datetime(created_at, '+5 hours', '30 minutes')) as mnth, SUM(grand_total) as amount
        FROM sales
        WHERE ${clause}
        GROUP BY mnth
        ORDER BY mnth ASC
      `, params);

      const profitRows = await client.query<{ mnth: string; profit: number }>(`
        SELECT strftime('%m', datetime(s.created_at, '+5 hours', '30 minutes')) as mnth,
               SUM(si.line_total - (p.purchase_price * si.quantity)) as profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE ${clause.replace(/created_at/g, "s.created_at")}
        GROUP BY mnth
      `, params);

      const profitMap = new Map<number, number>();
      for (const pr of profitRows) {
        profitMap.set(parseInt(pr.mnth, 10), pr.profit / 100.0);
      }

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthsMap = new Map<number, number>();
      for (let m = 1; m <= 12; m++) {
        monthsMap.set(m, 0);
      }
      for (const r of rows) {
        monthsMap.set(parseInt(r.mnth, 10), r.amount / 100.0);
      }

      return Array.from(monthsMap.keys()).map((m) => ({
        label: monthNames[m - 1],
        value: monthsMap.get(m) || 0,
        profit: profitMap.get(m) || 0,
      }));
    }

    // Default: Group by Date
    const rows = await client.query<{ dy: string; amount: number }>(`
      SELECT date(created_at, '+5 hours', '30 minutes') as dy, SUM(grand_total) as amount
      FROM sales
      WHERE ${clause}
      GROUP BY dy
      ORDER BY dy ASC
    `, params);

    const salesMap = new Map<string, number>();
    for (const r of rows) {
      salesMap.set(r.dy, r.amount / 100.0);
    }

    const profitRows = await client.query<{ dy: string; profit: number }>(`
      SELECT date(s.created_at, '+5 hours', '30 minutes') as dy,
             SUM(si.line_total - (p.purchase_price * si.quantity)) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY dy
    `, params);

    const profitMap = new Map<string, number>();
    for (const pr of profitRows) {
      profitMap.set(pr.dy, pr.profit / 100.0);
    }

    const dates: string[] = [];
    const now = new Date();
    let startLocalDate = new Date();
    let endLocalDate = new Date();

    if (filter === "last7") {
      startLocalDate.setDate(now.getDate() - 6);
    } else if (filter === "last30") {
      startLocalDate.setDate(now.getDate() - 29);
    } else if (filter === "thisMonth") {
      startLocalDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === "lastMonth") {
      startLocalDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endLocalDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filter === "custom" && startDate) {
      startLocalDate = new Date(startDate);
      endLocalDate = new Date(endDate || startDate);
    } else {
      startLocalDate.setDate(now.getDate() - 6);
    }

    const current = new Date(startLocalDate);
    while (current <= endLocalDate) {
      const dateStr = current.toISOString().substring(0, 10);
      dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    }

    return dates.map((d) => {
      const dateObj = new Date(d);
      const label = filter === "last7"
        ? dateObj.toLocaleDateString("en-IN", { weekday: "short" })
        : dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

      return {
        label,
        value: salesMap.get(d) || 0,
        profit: profitMap.get(d) || 0,
      };
    });
  }

  async getRecentInvoices(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<any[]> {
    const client = tx || this.db;
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    const rows = await client.query<{ id: string; date: string; payment: string; total: number }>(`
      SELECT s.invoice_number as id, 
             s.created_at as date,
             s.payment_method as payment,
             s.grand_total as total
      FROM sales s
      WHERE ${clause}
      ORDER BY s.id DESC
      LIMIT 100
    `, params);

    return rows.map((r) => ({
      id: r.id,
      date: formatToKolkataDateTime(r.date),
      payment: r.payment,
      total: r.total / 100.0,
    }));
  }

  async getTopCustomers(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<any[]> {
    const client = tx || this.db;
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    const rows = await client.query<{ name: string; phone: string; ordersCount: number; totalSpend: number }>(`
      SELECT c.name, c.phone, COUNT(s.id) as ordersCount, SUM(s.grand_total) as totalSpend
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY s.customer_id
      ORDER BY totalSpend DESC
      LIMIT 5
    `, params);

    return rows.map((r) => ({
      name: r.name,
      phone: r.phone,
      orders: r.ordersCount,
      spend: r.totalSpend / 100.0,
    }));
  }

  async getLowStockCount(tx?: DatabaseAdapter): Promise<number> {
    const client = tx || this.db;
    const row = await client.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM products WHERE stock < minimum_stock AND is_active = 1"
    );
    return row ? row.count : 0;
  }
}
