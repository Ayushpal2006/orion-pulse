import { IReportsRepository } from "../interfaces/IReportsRepository";
import { db } from "../../db";
import { sales, sale_items, products, customers } from "../../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresReportsRepository implements IReportsRepository {
  private getDateCondition(column: any, filter: string, startDate?: string, endDate?: string) {
    switch (filter) {
      case "today":
        return sql`timezone('Asia/Kolkata', ${column})::date = timezone('Asia/Kolkata', now())::date`;
      case "yesterday":
        return sql`timezone('Asia/Kolkata', ${column})::date = (timezone('Asia/Kolkata', now()) - interval '1 day')::date`;
      case "last7":
        return sql`timezone('Asia/Kolkata', ${column})::date >= (timezone('Asia/Kolkata', now()) - interval '6 days')::date`;
      case "last30":
        return sql`timezone('Asia/Kolkata', ${column})::date >= (timezone('Asia/Kolkata', now()) - interval '29 days')::date`;
      case "thisMonth":
        return sql`to_char(timezone('Asia/Kolkata', ${column}), 'YYYY-MM') = to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM')`;
      case "lastMonth":
        return sql`to_char(timezone('Asia/Kolkata', ${column}), 'YYYY-MM') = to_char(timezone('Asia/Kolkata', now()) - interval '1 month', 'YYYY-MM')`;
      case "thisYear":
        return sql`to_char(timezone('Asia/Kolkata', ${column}), 'YYYY') = to_char(timezone('Asia/Kolkata', now()), 'YYYY')`;
      case "custom":
        if (startDate) {
          const actualEnd = endDate || startDate;
          return sql`timezone('Asia/Kolkata', ${column})::date >= ${startDate}::date AND timezone('Asia/Kolkata', ${column})::date <= ${actualEnd}::date`;
        }
        return sql`1=1`;
      default:
        return sql`1=1`;
    }
  }

  async getSummary(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: any
  ): Promise<{
    revenue: number;
    orders: number;
    profit: number;
    averageOrderValue: number;
  }> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    // 1. Revenue
    const [revRow] = await client
      .select({ total: sql<string>`COALESCE(SUM(${sales.grand_total}), 0)` })
      .from(sales)
      .where(cond);
    const revenue = Number(revRow?.total || 0);

    // 2. Orders
    const [orderRow] = await client
      .select({ count: sql<string>`COUNT(*)` })
      .from(sales)
      .where(cond);
    const orders = Number(orderRow?.count || 0);

    // 3. Profit
    const [profitRow] = await client
      .select({ profit: sql<string>`COALESCE(SUM(${sale_items.line_total} - (${products.purchase_price} * ${sale_items.quantity})), 0)` })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(cond);
    const profit = Number(profitRow?.profit || 0);

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
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select({
        name: products.name,
        unitsSold: sql<string>`SUM(${sale_items.quantity})`,
        revenue: sql<string>`SUM(${sale_items.line_total})`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(cond)
      .groupBy(products.name, sale_items.product_id)
      .orderBy(desc(sql`SUM(${sale_items.quantity})`))
      .limit(10);

    return rows.map((r: any) => ({
      name: r.name,
      unitsSold: Number(r.unitsSold ?? 0),
      revenue: Number(r.revenue ?? 0) / 100.0,
    }));
  }

  async getGstSummary(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select({
        slab: products.gst,
        taxable: sql<string>`SUM(${sale_items.line_total})`,
        tax: sql<string>`SUM(${sale_items.line_total} * ${products.gst} / 100.0)`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(cond)
      .groupBy(products.gst)
      .orderBy(products.gst);

    return rows.map((r: any) => ({
      slab: `${r.slab}%`,
      taxable: Number(r.taxable ?? 0) / 100.0,
      tax: Math.round(Number(r.tax ?? 0)) / 100.0,
    }));
  }

  async getPaymentSplit(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: any
  ): Promise<Record<string, number>> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select({
        paymentMethod: sales.payment_method,
        amount: sql<string>`SUM(${sales.grand_total})`,
      })
      .from(sales)
      .where(cond)
      .groupBy(sales.payment_method);

    const result: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Wallet: 0, "Bank Transfer": 0, Split: 0 };
    for (const r of rows) {
      result[r.paymentMethod] = Number(r.amount) / 100.0;
    }
    return result;
  }

  async getTrendSeries(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    if (filter === "today" || filter === "yesterday") {
      const rows = await client
        .select({
          hr: sql<string>`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'HH24')`,
          amount: sql<string>`SUM(${sales.grand_total})`,
        })
        .from(sales)
        .where(cond)
        .groupBy(sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'HH24')`)
        .orderBy(sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'HH24')`);

      const profitRows = await client
        .select({
          hr: sql<string>`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'HH24')`,
          profit: sql<string>`SUM(${sale_items.line_total} - (${products.purchase_price} * ${sale_items.quantity}))`,
        })
        .from(sale_items)
        .innerJoin(sales, eq(sale_items.sale_id, sales.id))
        .innerJoin(products, eq(sale_items.product_id, products.id))
        .where(cond)
        .groupBy(sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'HH24')`);

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
      const rows = await client
        .select({
          mnth: sql<string>`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'MM')`,
          amount: sql<string>`SUM(${sales.grand_total})`,
        })
        .from(sales)
        .where(cond)
        .groupBy(sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'MM')`)
        .orderBy(sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'MM')`);

      const profitRows = await client
        .select({
          mnth: sql<string>`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'MM')`,
          profit: sql<string>`SUM(${sale_items.line_total} - (${products.purchase_price} * ${sale_items.quantity}))`,
        })
        .from(sale_items)
        .innerJoin(sales, eq(sale_items.sale_id, sales.id))
        .innerJoin(products, eq(sale_items.product_id, products.id))
        .where(cond)
        .groupBy(sql`to_char(timezone('Asia/Kolkata', ${sales.created_at}), 'MM')`);

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
    const rows = await client
      .select({
        dy: sql<any>`timezone('Asia/Kolkata', ${sales.created_at})::date`,
        amount: sql<string>`SUM(${sales.grand_total})`,
      })
      .from(sales)
      .where(cond)
      .groupBy(sql`timezone('Asia/Kolkata', ${sales.created_at})::date`)
      .orderBy(sql`timezone('Asia/Kolkata', ${sales.created_at})::date`);

    const salesMap = new Map<string, number>();
    for (const r of rows) {
      const dyStr = r.dy instanceof Date ? r.dy.toISOString().substring(0, 10) : String(r.dy);
      salesMap.set(dyStr, Number(r.amount) / 100.0);
    }

    const profitRows = await client
      .select({
        dy: sql<any>`timezone('Asia/Kolkata', ${sales.created_at})::date`,
        profit: sql<string>`SUM(${sale_items.line_total} - (${products.purchase_price} * ${sale_items.quantity}))`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(cond)
      .groupBy(sql`timezone('Asia/Kolkata', ${sales.created_at})::date`);

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
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select({
        id: sales.id,
        invoiceNumber: sales.invoice_number,
        date: sales.created_at,
        customerName: customers.name,
        paymentMethod: sales.payment_method,
        grandTotal: sales.grand_total,
        pdfUrl: sales.pdf_url,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customer_id, customers.id))
      .where(cond)
      .orderBy(desc(sales.id));

    return rows.map((r: any) => ({
      ...r,
      date: r.date.toISOString(),
      grandTotal: Number(r.grandTotal ?? 0) / 100.0,
      total: Number(r.grandTotal ?? 0) / 100.0,
      payment: r.paymentMethod,
    }));
  }

  async getTopCustomers(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: any
  ): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    if (storeId !== undefined) {
      cond = and(cond, eq(sales.store_id, storeId)) as any;
    }

    const rows = await client
      .select({
        name: customers.name,
        phone: customers.phone,
        orders: sql<string>`COUNT(${sales.id})`,
        ltv: sql<string>`SUM(${sales.grand_total})`,
      })
      .from(sales)
      .innerJoin(customers, eq(sales.customer_id, customers.id))
      .where(cond)
      .groupBy(customers.name, customers.phone, sales.customer_id)
      .orderBy(desc(sql`SUM(${sales.grand_total})`))
      .limit(10);

    return rows.map((r: any) => ({
      name: r.name,
      phone: r.phone,
      orders: Number(r.orders ?? 0),
      spend: Number(r.ltv ?? 0) / 100.0,
      ltv: Number(r.ltv ?? 0) / 100.0,
    }));
  }

  async getLowStockCount(tx?: any): Promise<number> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = and(
      eq(products.is_active, 1),
      sql`${products.stock} <= ${products.minimum_stock}`
    );
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

    const [row] = await client
      .select({ count: sql<string>`COUNT(*)` })
      .from(products)
      .where(cond);

    return Number(row?.count || 0);
  }
}
