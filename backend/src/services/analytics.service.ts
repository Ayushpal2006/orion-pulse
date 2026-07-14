import { db } from "../db";
import { sales, sale_items, products, customers, purchase_orders, expenses, return_items } from "../db/schema";
import { eq, and, sql, desc, sum, count, gte, lte } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError } from "../utils/errors";
import { getUtcBoundariesForFilter } from "../utils/datetime";

export class AnalyticsService {
  private getDateCondition(column: any, filter: string, startDate?: string, endDate?: string) {
    const { start, end } = getUtcBoundariesForFilter(filter, startDate, endDate);
    return and(gte(column, start), lte(column, end));
  }

  async getSalesAnalytics(filter: string, startDate?: string, endDate?: string): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    cond = and(cond, eq(sales.store_id, storeId)) as any;

    const [salesStats] = await db
      .select({
        revenue: sql<string>`COALESCE(SUM(${sales.grand_total}), 0)`,
        orders: sql<string>`COUNT(*)`,
        discount: sql<string>`COALESCE(SUM(${sales.discount}), 0)`,
        gst: sql<string>`COALESCE(SUM(${sales.gst}), 0)`,
        subtotal: sql<string>`COALESCE(SUM(${sales.subtotal}), 0)`,
      })
      .from(sales)
      .where(cond);

    const [itemsStats] = await db
      .select({
        unitsSold: sql<string>`COALESCE(SUM(${sale_items.quantity}), 0)`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .where(cond);

    const rev = Number(salesStats?.revenue || 0);
    const ords = Number(salesStats?.orders || 0);

    return {
      revenue_INR: rev / 100.0,
      ordersCount: ords,
      discount_INR: Number(salesStats?.discount || 0) / 100.0,
      tax_INR: Number(salesStats?.gst || 0) / 100.0,
      subtotal_INR: Number(salesStats?.subtotal || 0) / 100.0,
      averageBillValue_INR: ords > 0 ? (rev / ords) / 100.0 : 0,
      itemsSold: Number(itemsStats?.unitsSold || 0),
    };
  }

  async getProfitAnalytics(filter: string, startDate?: string, endDate?: string): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    let cond = this.getDateCondition(sales.created_at, filter, startDate, endDate);
    cond = and(cond, eq(sales.store_id, storeId)) as any;

    // Gross Revenue
    const [revRow] = await db
      .select({ revenue: sql<string>`COALESCE(SUM(${sales.grand_total}), 0)` })
      .from(sales)
      .where(cond);
    const revenue = Number(revRow?.revenue || 0);

    // Total Cost of Goods Sold (COGS)
    const [cogsRow] = await db
      .select({ cost: sql<string>`COALESCE(SUM(${products.purchase_price} * ${sale_items.quantity}), 0)` })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(cond);
    const cogs = Number(cogsRow?.cost || 0);

    // Total expenses in the same period
    let expenseCond = this.getDateCondition(expenses.date, filter, startDate, endDate);
    expenseCond = and(expenseCond, eq(expenses.store_id, storeId)) as any;
    const [expRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(expenseCond);
    const expensesTotal = Number(expRow?.total || 0);

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expensesTotal;

    return {
      revenue_INR: revenue / 100.0,
      cogs_INR: cogs / 100.0,
      expenses_INR: expensesTotal / 100.0,
      grossProfit_INR: grossProfit / 100.0,
      netProfit_INR: netProfit / 100.0,
      grossProfit_percent: revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0,
      netProfit_percent: revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0,
    };
  }

  async getCustomerAnalytics(): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    const [totals] = await db
      .select({
        totalCount: sql<string>`COUNT(*)`,
        totalLtv: sql<string>`COALESCE(SUM(${customers.lifetime_value}), 0)`,
        totalOrders: sql<string>`COALESCE(SUM(${customers.total_orders}), 0)`,
      })
      .from(customers)
      .where(and(eq(customers.is_active, 1), eq(customers.store_id, storeId)));

    const countCust = Number(totals?.totalCount || 0);
    const totalLtvVal = Number(totals?.totalLtv || 0);

    const vipCustomers = await db
      .select()
      .from(customers)
      .where(and(eq(customers.is_active, 1), eq(customers.store_id, storeId)))
      .orderBy(desc(customers.lifetime_value))
      .limit(10);

    return {
      totalCustomers: countCust,
      lifetimeValueTotal_INR: totalLtvVal / 100.0,
      averageSpendPerCustomer_INR: countCust > 0 ? (totalLtvVal / countCust) / 100.0 : 0,
      totalOrdersCount: Number(totals?.totalOrders || 0),
      topVIPCustomers: vipCustomers.map((c) => ({
        name: c.name,
        phone: c.phone,
        totalOrders: c.total_orders,
        ltv_INR: c.lifetime_value / 100.0,
      })),
    };
  }

  async getProductAnalytics(): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    // Top selling products based on units sold
    const bestSellers = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        unitsSold: sql<string>`SUM(${sale_items.quantity})`,
        revenue: sql<string>`SUM(${sale_items.line_total})`,
      })
      .from(sale_items)
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(and(eq(products.is_active, 1), eq(products.store_id, storeId)))
      .groupBy(products.id, products.name, products.sku)
      .orderBy(desc(sql`SUM(${sale_items.quantity})`))
      .limit(10);

    // Worst sellers (products with low sold count or active but 0 sales)
    const worstSellers = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        stock: products.stock,
      })
      .from(products)
      .where(and(eq(products.is_active, 1), eq(products.store_id, storeId)))
      .orderBy(products.stock)
      .limit(10);

    return {
      bestSellers: bestSellers.map((r: any) => ({
        productId: r.id,
        name: r.name,
        sku: r.sku,
        unitsSold: Number(r.unitsSold),
        revenue_INR: Number(r.revenue) / 100.0,
      })),
      worstSellers,
    };
  }

  async getCashflow(): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    // Cashflow of current month
    const { start: startThisMonth, end: endThisMonth } = getUtcBoundariesForFilter("thisMonth");
    const thisMonthCond = and(gte(sales.created_at, startThisMonth), lte(sales.created_at, endThisMonth));
    const thisMonthSales = await db
      .select({
        method: sales.payment_method,
        total: sql<string>`SUM(${sales.grand_total})`,
      })
      .from(sales)
      .where(and(thisMonthCond, eq(sales.store_id, storeId)))
      .groupBy(sales.payment_method);

    const cashflowSales: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Wallet: 0, "Bank Transfer": 0, Split: 0 };
    let salesTotal = 0;
    for (const r of thisMonthSales) {
      cashflowSales[r.method] = Number(r.total) / 100.0;
      salesTotal += Number(r.total);
    }

    const thisMonthExpCond = and(gte(expenses.date, startThisMonth), lte(expenses.date, endThisMonth));
    const [expRow] = await db
      .select({ total: sql<string>`SUM(${expenses.amount})` })
      .from(expenses)
      .where(and(thisMonthExpCond, eq(expenses.store_id, storeId)));
    const expensesTotal = Number(expRow?.total || 0);

    return {
      currentMonthSalesSplit_INR: cashflowSales,
      totalInflowSales_INR: salesTotal / 100.0,
      totalOutflowExpenses_INR: expensesTotal / 100.0,
      netCashflow_INR: (salesTotal - expensesTotal) / 100.0,
    };
  }

  async getForecast(): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    // 1. Fetch last 3 months sales totals for moving average
    const salesHistory = await db
      .select({
        monthStr: sql<string>`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'YYYY-MM')`,
        total: sql<string>`SUM(${sales.grand_total})`,
      })
      .from(sales)
      .where(eq(sales.store_id, storeId))
      .groupBy(sql`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'YYYY-MM')`)
      .orderBy(desc(sql`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'YYYY-MM')`))
      .limit(3);

    let sumRev = 0;
    let monthsCount = salesHistory.length;
    for (const row of salesHistory) {
      sumRev += Number(row.total);
    }

    const expectedMonthlyRevenue = monthsCount > 0 ? (sumRev / monthsCount) / 100.0 : 15000.0; // Default fallback if new store

    // 2. Fetch last 3 months expenses totals for moving average
    const expensesHistory = await db
      .select({
        monthStr: sql<string>`to_char(timezone('Asia/Kolkata', timezone('UTC', ${expenses.date})), 'YYYY-MM')`,
        total: sql<string>`SUM(${expenses.amount})`,
      })
      .from(expenses)
      .where(eq(expenses.store_id, storeId))
      .groupBy(sql`to_char(timezone('Asia/Kolkata', timezone('UTC', ${expenses.date})), 'YYYY-MM')`)
      .orderBy(desc(sql`to_char(timezone('Asia/Kolkata', timezone('UTC', ${expenses.date})), 'YYYY-MM')`))
      .limit(3);

    let sumExp = 0;
    for (const row of expensesHistory) {
      sumExp += Number(row.total);
    }
    const expectedMonthlyExpenses = expensesHistory.length > 0 ? (sumExp / expensesHistory.length) / 100.0 : 2000.0;

    const expectedProfit = Math.max(0, expectedMonthlyRevenue * 0.25 - expectedMonthlyExpenses); // estimate 25% average markup profit

    return {
      expectedMonthlyRevenue_INR: expectedMonthlyRevenue,
      expectedMonthlyExpenses_INR: expectedMonthlyExpenses,
      expectedProfit_INR: expectedProfit,
      expectedInventoryNeed_INR: expectedMonthlyRevenue * 0.7, // 70% cost estimate
      expectedCashFlow_INR: expectedMonthlyRevenue - expectedMonthlyExpenses,
    };
  }

  async getInsights(): Promise<string[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      return ["Store context is required"];
    }

    const insights: string[] = [];

    // 1. Check low stock items
    const [lowStockRow] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(products)
      .where(and(eq(products.is_active, 1), eq(products.store_id, storeId), sql`${products.stock} <= ${products.minimum_stock}`));
    const lowStock = Number(lowStockRow?.count || 0);
    if (lowStock > 0) {
      insights.push(`🚨 Alert: ${lowStock} products are running low on stock. Generate reorder suggestions immediately.`);
    } else {
      insights.push("💚 Stock levels are optimal across all categories.");
    }

    // 2. Compute gross profit margins
    const profit = await this.getProfitAnalytics("thisMonth");
    if (profit.revenue_INR > 0) {
      insights.push(`📊 Business summary: Current month gross margin is ${profit.grossProfit_percent}% with a net margin of ${profit.netProfit_percent}%.`);
      if (profit.netProfit_percent < 5) {
        insights.push("⚠️ Margin Alert: Expenses are high relative to revenue. Review outflow cash points.");
      }
    } else {
      insights.push("ℹ️ No transactions recorded yet for this month.");
    }

    // 3. Highlight top category
    const topCategoryRow = await db
      .select({
        category: products.category,
        total: sql<string>`SUM(${sale_items.line_total})`,
      })
      .from(sale_items)
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(eq(products.store_id, storeId))
      .groupBy(products.category)
      .orderBy(desc(sql`SUM(${sale_items.line_total})`))
      .limit(1);

    if (topCategoryRow[0] && topCategoryRow[0].category) {
      insights.push(`⭐ Spotlight: "${topCategoryRow[0].category}" is the most profitable product category.`);
    }

    return insights;
  }

  async getKPIs(): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    // Quick summary KPIs
    const thisMonthSales = await this.getSalesAnalytics("thisMonth");
    const lastMonthSales = await this.getSalesAnalytics("lastMonth");

    const revGrowth = lastMonthSales.revenue_INR > 0
      ? Math.round(((thisMonthSales.revenue_INR - lastMonthSales.revenue_INR) / lastMonthSales.revenue_INR) * 100)
      : 0;

    const [totalSales] = await db
      .select({
        count: count(),
        revenue: sum(sales.grand_total),
      })
      .from(sales)
      .where(eq(sales.store_id, storeId));

    const totalRevenueVal = Number(totalSales?.revenue || 0) / 100.0;
    const totalSalesCount = Number(totalSales?.count || 0);

    return {
      revenueGrowth_percent: revGrowth,
      averageDailySales_INR: totalSalesCount > 0 ? totalRevenueVal / 30.0 : 0.0, // estimate average monthly sales rate
      kpiSummary: {
        totalRevenue_INR: totalRevenueVal,
        totalSalesCount,
        growthDirection: revGrowth >= 0 ? "Upward" : "Downward",
      },
    };
  }
}
