import { IDashboardRepository } from "../interfaces/IDashboardRepository";
import { db } from "../../db";
import { sales, sale_items, products, customers } from "../../db/schema";
import { eq, and, desc, sql, gte, lte, ne } from "drizzle-orm";
import { getStoreId } from "../../db/context";
import { getUtcBoundariesForFilter } from "../../utils/datetime";

export class PostgresDashboardRepository implements IDashboardRepository {
  async getTodaySummary(tx?: any): Promise<{
    todayRevenue: number;
    todayOrders: number;
    todayProfit: number;
    inventoryCount: number;
    lowStockCount: number;
  }> {
    const client = tx || db;
    const storeId = getStoreId();

    const { start, end } = getUtcBoundariesForFilter("today");
    let salesCond = and(gte(sales.created_at, start), lte(sales.created_at, end), ne(sales.status, "VOID")) as any;
    let productsCond = eq(products.is_active, 1);

    if (storeId !== undefined) {
      salesCond = and(salesCond, eq(sales.store_id, storeId)) as any;
      productsCond = and(productsCond, eq(products.store_id, storeId)) as any;
    }

    // 1. Revenue Today
    const [revRow] = await client
      .select({ total: sql<string>`COALESCE(SUM(${sales.grand_total}), 0)` })
      .from(sales)
      .where(salesCond);
    const revenue = Number(revRow?.total || 0);

    // 2. Orders Today
    const [orderRow] = await client
      .select({ count: sql<string>`COUNT(*)` })
      .from(sales)
      .where(salesCond);
    const orders = Number(orderRow?.count || 0);

    // 3. Profit Today
    let profitCond = and(gte(sales.created_at, start), lte(sales.created_at, end), ne(sales.status, "VOID")) as any;
    if (storeId !== undefined) {
      profitCond = and(profitCond, eq(sales.store_id, storeId)) as any;
    }
    const [profitRow] = await client
      .select({ profit: sql<string>`COALESCE(SUM(${sale_items.line_total} - (${products.purchase_price} * ${sale_items.quantity})), 0)` })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(profitCond);
    const profit = Number(profitRow?.profit || 0);

    // 4. Inventory Count
    const [invRow] = await client
      .select({ count: sql<string>`COUNT(*)` })
      .from(products)
      .where(productsCond);
    const inventoryCount = Number(invRow?.count || 0);

    // 5. Low Stock Count
    const lowStockCond = and(productsCond, sql`${products.stock} <= ${products.minimum_stock}`);
    const [lowStockRow] = await client
      .select({ count: sql<string>`COUNT(*)` })
      .from(products)
      .where(lowStockCond);
    const lowStockCount = Number(lowStockRow?.count || 0);

    return {
      todayRevenue: revenue / 100.0,
      todayOrders: orders,
      todayProfit: profit / 100.0,
      inventoryCount,
      lowStockCount,
    };
  }

  async getTopProducts(tx?: any): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();

    let cond = and(eq(products.is_active, 1), ne(sales.status, "VOID")) as any;
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

    const rows = await client
      .select({
        name: products.name,
        unitsSold: sql<string>`SUM(${sale_items.quantity})`,
        revenue: sql<string>`SUM(${sale_items.line_total})`,
      })
      .from(sale_items)
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .where(cond)
      .groupBy(products.name, sale_items.product_id)
      .orderBy(desc(sql`SUM(${sale_items.quantity})`))
      .limit(10);

    return rows.map((r: any, i: number) => ({
      rank: i + 1,
      name: r.name,
      unitsSold: Number(r.unitsSold ?? 0),
      revenue: Number(r.revenue ?? 0) / 100.0,
    }));
  }

  async getRecentSales(tx?: any): Promise<any[]> {
    const client = tx || db;
    const storeId = getStoreId();

    const conditions: any[] = [];
    if (storeId !== undefined) {
      conditions.push(eq(sales.store_id, storeId));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select({
        invoiceNumber: sales.invoice_number,
        customer: sql<string>`COALESCE(${customers.name}, 'Walk-in')`,
        amount: sales.grand_total,
        payment: sales.payment_method,
        time: sales.created_at,
        status: sales.status,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customer_id, customers.id))
      .where(whereClause)
      .orderBy(desc(sales.id))
      .limit(10);

    return rows.map((r: any) => ({
      invoiceNumber: r.invoiceNumber,
      customer: r.customer,
      amount: Number(r.amount ?? 0) / 100.0,
      payment: r.payment,
      time: r.time instanceof Date ? r.time.toISOString() : (r.time ? new Date(r.time).toISOString() : new Date().toISOString()),
      status: r.status,
    }));
  }
}
