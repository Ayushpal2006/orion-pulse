import { IReportsRepository } from "../interfaces/IReportsRepository";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";
import { formatToKolkataDateTime } from "../../utils/datetime";

export class PostgresReportsRepository implements IReportsRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  private getDateCondition(filter: string, startDate?: string, endDate?: string) {
    let clause = "1=1";
    const params: any = {};

    switch (filter) {
      case "today":
        clause = "timezone('Asia/Kolkata', created_at)::date = timezone('Asia/Kolkata', now())::date";
        break;
      case "yesterday":
        clause = "timezone('Asia/Kolkata', created_at)::date = (timezone('Asia/Kolkata', now()) - interval '1 day')::date";
        break;
      case "last7":
        clause = "timezone('Asia/Kolkata', created_at)::date >= (timezone('Asia/Kolkata', now()) - interval '6 days')::date";
        break;
      case "last30":
        clause = "timezone('Asia/Kolkata', created_at)::date >= (timezone('Asia/Kolkata', now()) - interval '29 days')::date";
        break;
      case "thisMonth":
        clause = "to_char(timezone('Asia/Kolkata', created_at), 'YYYY-MM') = to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM')";
        break;
      case "lastMonth":
        clause = "to_char(timezone('Asia/Kolkata', created_at), 'YYYY-MM') = to_char(timezone('Asia/Kolkata', now()) - interval '1 month', 'YYYY-MM')";
        break;
      case "thisYear":
        clause = "to_char(timezone('Asia/Kolkata', created_at), 'YYYY') = to_char(timezone('Asia/Kolkata', now()), 'YYYY')";
        break;
      case "custom":
        if (startDate) {
          const actualEnd = endDate || startDate;
          clause = "timezone('Asia/Kolkata', created_at)::date >= $startDate::date AND timezone('Asia/Kolkata', created_at)::date <= $endDate::date";
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
    const revRow = await client.queryOne<{ total: string | number }>(`
      SELECT COALESCE(SUM(grand_total), 0) as total 
      FROM sales 
      WHERE ${clause}
    `, params);
    const revenue = Number(revRow ? revRow.total : 0);

    // 2. Orders
    const orderRow = await client.queryOne<{ count: string | number }>(`
      SELECT COUNT(*) as count 
      FROM sales 
      WHERE ${clause}
    `, params);
    const orders = Number(orderRow ? orderRow.count : 0);

    // 3. Profit
    const profitRow = await client.queryOne<{ profit: string | number }>(`
      SELECT COALESCE(SUM(si.line_total - (p.purchase_price * si.quantity)), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
    `, params);
    const profit = Number(profitRow ? profitRow.profit : 0);

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

    const rows = await client.query<{ name: string; "unitsSold": string | number; revenue: string | number }>(`
      SELECT p.name, SUM(si.quantity) as "unitsSold", SUM(si.line_total) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY p.name, si.product_id
      ORDER BY "unitsSold" DESC
      LIMIT 10
    `, params);

    return rows.map((r) => ({
      name: r.name,
      unitsSold: Number(r.unitsSold),
      revenue: Number(r.revenue) / 100.0,
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

    const rows = await client.query<{ slab: number; taxable: string | number; tax: string | number }>(`
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
      taxable: Number(r.taxable) / 100.0,
      tax: Math.round(Number(r.tax)) / 100.0,
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

    const rows = await client.query<{ paymentMethod: string; amount: string | number }>(`
      SELECT payment_method as "paymentMethod", SUM(grand_total) as amount
      FROM sales
      WHERE ${clause}
      GROUP BY payment_method
    `, params);

    const result: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Wallet: 0 };
    for (const r of rows) {
      result[r.paymentMethod] = Number(r.amount) / 100.0;
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
      const rows = await client.query<{ hr: string; amount: string | number }>(`
        SELECT to_char(timezone('Asia/Kolkata', created_at), 'HH24') as hr, SUM(grand_total) as amount
        FROM sales
        WHERE ${clause}
        GROUP BY hr
        ORDER BY hr ASC
      `, params);

      const profitRows = await client.query<{ hr: string; profit: string | number }>(`
        SELECT to_char(timezone('Asia/Kolkata', s.created_at), 'HH24') as hr,
               SUM(si.line_total - (p.purchase_price * si.quantity)) as profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE ${clause.replace(/created_at/g, "s.created_at")}
        GROUP BY hr
      `, params);

      const profitMap = new Map<number, number>();
      for (const pr of profitRows) {
        profitMap.set(parseInt(pr.hr, 10), Number(pr.profit) / 100.0);
      }

      const hoursMap = new Map<number, number>();
      for (let h = 9; h <= 18; h++) {
        hoursMap.set(h, 0);
      }
      for (const r of rows) {
        const hourNum = parseInt(r.hr, 10);
        hoursMap.set(hourNum, Number(r.amount) / 100.0);
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
      const rows = await client.query<{ mnth: string; amount: string | number }>(`
        SELECT to_char(timezone('Asia/Kolkata', created_at), 'MM') as mnth, SUM(grand_total) as amount
        FROM sales
        WHERE ${clause}
        GROUP BY mnth
        ORDER BY mnth ASC
      `, params);

      const profitRows = await client.query<{ mnth: string; profit: string | number }>(`
        SELECT to_char(timezone('Asia/Kolkata', s.created_at), 'MM') as mnth,
               SUM(si.line_total - (p.purchase_price * si.quantity)) as profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE ${clause.replace(/created_at/g, "s.created_at")}
        GROUP BY mnth
      `, params);

      const profitMap = new Map<number, number>();
      for (const pr of profitRows) {
        profitMap.set(parseInt(pr.mnth, 10), Number(pr.profit) / 100.0);
      }

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthsMap = new Map<number, number>();
      for (let m = 1; m <= 12; m++) {
        monthsMap.set(m, 0);
      }
      for (const r of rows) {
        monthsMap.set(parseInt(r.mnth, 10), Number(r.amount) / 100.0);
      }

      return Array.from(monthsMap.keys()).map((m) => ({
        label: monthNames[m - 1],
        value: monthsMap.get(m) || 0,
        profit: profitMap.get(m) || 0,
      }));
    }

    // Default: Group by Date
    const rows = await client.query<{ dy: any; amount: string | number }>(`
      SELECT timezone('Asia/Kolkata', created_at)::date as dy, SUM(grand_total) as amount
      FROM sales
      WHERE ${clause}
      GROUP BY dy
      ORDER BY dy ASC
    `, params);

    const salesMap = new Map<string, number>();
    for (const r of rows) {
      const dyStr = r.dy instanceof Date ? r.dy.toISOString().substring(0, 10) : String(r.dy);
      salesMap.set(dyStr, Number(r.amount) / 100.0);
    }

    const profitRows = await client.query<{ dy: any; profit: string | number }>(`
      SELECT timezone('Asia/Kolkata', s.created_at)::date as dy,
             SUM(si.line_total - (p.purchase_price * si.quantity)) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY dy
    `, params);

    const profitMap = new Map<string, number>();
    for (const pr of profitRows) {
      const dyStr = pr.dy instanceof Date ? pr.dy.toISOString().substring(0, 10) : String(pr.dy);
      profitMap.set(dyStr, Number(pr.profit) / 100.0);
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

    const rows = await client.query<{ id: string; date: any; payment: string; total: string | number }>(`
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
      total: Number(r.total) / 100.0,
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

    const rows = await client.query<{ name: string; phone: string; "ordersCount": string | number; "totalSpend": string | number }>(`
      SELECT c.name, c.phone, COUNT(s.id) as "ordersCount", SUM(s.grand_total) as "totalSpend"
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY c.name, c.phone, s.customer_id
      ORDER BY "totalSpend" DESC
      LIMIT 5
    `, params);

    return rows.map((r) => ({
      name: r.name,
      phone: r.phone,
      orders: Number(r.ordersCount),
      spend: Number(r.totalSpend) / 100.0,
    }));
  }

  async getLowStockCount(tx?: DatabaseAdapter): Promise<number> {
    const client = tx || this.db;
    const row = await client.queryOne<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM products WHERE stock < minimum_stock AND is_active = 1"
    );
    return Number(row ? row.count : 0);
  }
}
