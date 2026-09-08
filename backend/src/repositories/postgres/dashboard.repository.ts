import { IDashboardRepository } from "../interfaces/IDashboardRepository";
import { db } from "../../db";
import { sales, sale_items, products, customers, inventory_adjustments } from "../../db/schema";
import { eq, and, desc, sql, gte, lte, ne } from "drizzle-orm";
import { getTenantContext } from "../../db/context";
import { getUtcBoundariesForFilter } from "../../utils/datetime";

export class PostgresDashboardRepository implements IDashboardRepository {
  async getTodaySummary(tx?: any): Promise<{
    todayRevenue: number;
    todayOrders: number;
    todayProfit: number;
    inventoryCount: number;
    lowStockCount: number;
    pendingAdjustments?: number;
    inventoryValuation?: number;
  }> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();

    const { start, end } = getUtcBoundariesForFilter("today");
    const salesCond = and(
      gte(sales.created_at, start),
      lte(sales.created_at, end),
      ne(sales.status, "VOID"),
      eq(sales.organization_id, organizationId),
      eq(sales.store_id, currentStoreId)
    );
    const productsCond = and(
      eq(products.is_active, 1),
      eq(products.organization_id, organizationId),
      eq(products.store_id, currentStoreId)
    );
    const adjustmentsCond = and(
      gte(inventory_adjustments.created_at, start),
      lte(inventory_adjustments.created_at, end),
      eq(inventory_adjustments.organization_id, organizationId),
      eq(inventory_adjustments.store_id, currentStoreId)
    );

    // Execute independent queries concurrently via Promise.all
    // Consolidates total product count, low stock count, and stock valuation into 1 single query
    const [salesStatsRow, profitRow, invProductRow, adjustmentsRow] = await Promise.all([
      client
        .select({
          total: sql<string>`COALESCE(SUM(${sales.grand_total}), 0)`,
          count: sql<string>`COUNT(*)`
        })
        .from(sales)
        .where(salesCond),
      client
        .select({ profit: sql<string>`COALESCE(SUM(${sale_items.line_total} - (${products.purchase_price} * ${sale_items.quantity})), 0)` })
        .from(sale_items)
        .innerJoin(sales, eq(sale_items.sale_id, sales.id))
        .innerJoin(products, eq(sale_items.product_id, products.id))
        .where(salesCond),
      client
        .select({
          totalCount: sql<string>`COUNT(*)`,
          lowStockCount: sql<string>`COUNT(CASE WHEN ${products.stock} <= ${products.minimum_stock} THEN 1 END)`,
          valuation: sql<string>`COALESCE(SUM(${products.selling_price} * ${products.stock}), 0)`,
        })
        .from(products)
        .where(productsCond),
      client
        .select({ count: sql<string>`COUNT(*)` })
        .from(inventory_adjustments)
        .where(adjustmentsCond),
    ]);

    const revenue = Number(salesStatsRow[0]?.total || 0);
    const orders = Number(salesStatsRow[0]?.count || 0);
    const profit = Number(profitRow[0]?.profit || 0);
    const inventoryCount = Number(invProductRow[0]?.totalCount || 0);
    const lowStockCount = Number(invProductRow[0]?.lowStockCount || 0);
    const pendingAdjustments = Number(adjustmentsRow[0]?.count || 0);
    const inventoryValuation = Number(invProductRow[0]?.valuation || 0) / 100.0;

    return {
      todayRevenue: revenue / 100.0,
      todayOrders: orders,
      todayProfit: profit / 100.0,
      inventoryCount,
      lowStockCount,
      pendingAdjustments,
      inventoryValuation,
    };
  }

  async getTopProducts(tx?: any): Promise<any[]> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();

    let cond = and(
      eq(products.is_active, 1),
      ne(sales.status, "VOID"),
      eq(products.organization_id, organizationId),
      eq(products.store_id, currentStoreId)
    );

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
    const { organizationId, currentStoreId } = getTenantContext();

    const conditions: any[] = [
      eq(sales.organization_id, organizationId),
      eq(sales.store_id, currentStoreId)
    ];
    const whereClause = and(...conditions);

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
      .orderBy(desc(sales.created_at), desc(sales.id))
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
