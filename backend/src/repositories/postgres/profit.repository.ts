import { db } from "../../db";
import { sales, sale_items, products, product_cost_history } from "../../db/schema";
import { eq, and, sql, desc, asc, gte, lte, isNull, not } from "drizzle-orm";
import { getUtcBoundariesForFilter } from "../../utils/datetime";
import type { IProfitRepository } from "../interfaces/IProfitRepository";
import type {
  ProfitFilters,
  ProfitSummary,
  ProductProfitRow,
  SaleProfitRow,
  ProfitTrendPoint,
} from "../../types/profit.types";

/**
 * PostgresProfitRepository
 *
 * All COGS calculations use products.average_cost (Average Cost Method).
 * Architecture is FIFO-ready: swap average_cost for FIFO lot cost in the future.
 *
 * Money: all raw values in paise, _INR fields divided by 100.
 */
export class PostgresProfitRepository implements IProfitRepository {

  // ─── Shared Helpers ────────────────────────────────────────────────────────

  private getDateCondition(filter: string, startDate?: string, endDate?: string) {
    const { start, end } = getUtcBoundariesForFilter(filter, startDate, endDate);
    return and(gte(sales.created_at, start), lte(sales.created_at, end));
  }

  private buildWhere(storeId: number, filters: ProfitFilters) {
    const dateCond = this.getDateCondition(
      filters.filter || "last30",
      filters.startDate,
      filters.endDate
    );
    return and(
      eq(sales.store_id, storeId),
      eq(sales.status, "COMPLETED"),
      dateCond
    );
  }

  // ─── getSummary ─────────────────────────────────────────────────────────────

  async getSummary(filters: ProfitFilters & { storeId: number }): Promise<ProfitSummary> {
    const where = this.buildWhere(filters.storeId, filters);

    // Single join query: revenue + cogs + counts — no N+1
    const [row] = await db
      .select({
        revenue: sql<string>`COALESCE(SUM(${sale_items.line_total}), 0)`,
        cogs: sql<string>`COALESCE(SUM(${sale_items.quantity} * ${products.average_cost}), 0)`,
        unitsSold: sql<string>`COALESCE(SUM(${sale_items.quantity}), 0)`,
        invoiceCount: sql<string>`COUNT(DISTINCT ${sales.id})`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(where);

    const revenue = Number(row?.revenue || 0);
    const cogs = Number(row?.cogs || 0);
    const grossProfit = revenue - cogs;
    const grossMarginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;

    return {
      revenue,
      cogs,
      grossProfit,
      grossMarginPercent,
      unitsSold: Number(row?.unitsSold || 0),
      invoiceCount: Number(row?.invoiceCount || 0),
      revenue_INR: revenue / 100,
      cogs_INR: cogs / 100,
      grossProfit_INR: grossProfit / 100,
    };
  }

  // ─── getProductBreakdown ────────────────────────────────────────────────────

  async getProductBreakdown(filters: ProfitFilters & { storeId: number }): Promise<ProductProfitRow[]> {
    const where = this.buildWhere(filters.storeId, filters);
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await db
      .select({
        productId: products.id,
        name: products.name,
        sku: products.sku,
        category: products.category,
        unitsSold: sql<string>`COALESCE(SUM(${sale_items.quantity}), 0)`,
        revenue: sql<string>`COALESCE(SUM(${sale_items.line_total}), 0)`,
        cogs: sql<string>`COALESCE(SUM(${sale_items.quantity} * ${products.average_cost}), 0)`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(
        filters.category
          ? and(where, eq(products.category, filters.category))
          : where
      )
      .groupBy(products.id, products.name, products.sku, products.category)
      .orderBy(desc(sql`SUM(${sale_items.line_total}) - SUM(${sale_items.quantity} * ${products.average_cost})`))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => {
      const revenue = Number(r.revenue);
      const cogs = Number(r.cogs);
      const grossProfit = revenue - cogs;
      const grossMarginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;
      return {
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        category: r.category,
        unitsSold: Number(r.unitsSold),
        revenue,
        cogs,
        grossProfit,
        grossMarginPercent,
        revenue_INR: revenue / 100,
        cogs_INR: cogs / 100,
        grossProfit_INR: grossProfit / 100,
      };
    });
  }

  // ─── getSaleBreakdown ───────────────────────────────────────────────────────

  async getSaleBreakdown(filters: ProfitFilters & { storeId: number }): Promise<SaleProfitRow[]> {
    const where = this.buildWhere(filters.storeId, filters);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await db
      .select({
        saleId: sales.id,
        invoiceNumber: sales.invoice_number,
        date: sales.created_at,
        revenue: sql<string>`COALESCE(SUM(${sale_items.line_total}), 0)`,
        cogs: sql<string>`COALESCE(SUM(${sale_items.quantity} * ${products.average_cost}), 0)`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(where)
      .groupBy(sales.id, sales.invoice_number, sales.created_at)
      .orderBy(desc(sales.created_at))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => {
      const revenue = Number(r.revenue);
      const cogs = Number(r.cogs);
      const grossProfit = revenue - cogs;
      const grossMarginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;
      return {
        saleId: r.saleId,
        invoiceNumber: r.invoiceNumber,
        date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
        revenue,
        cogs,
        grossProfit,
        grossMarginPercent,
        revenue_INR: revenue / 100,
        cogs_INR: cogs / 100,
        grossProfit_INR: grossProfit / 100,
      };
    });
  }

  // ─── getDailyTrend ──────────────────────────────────────────────────────────

  async getDailyTrend(filters: ProfitFilters & { storeId: number }): Promise<ProfitTrendPoint[]> {
    const { start, end } = getUtcBoundariesForFilter(
      filters.filter || "last30",
      filters.startDate,
      filters.endDate
    );

    const rows = await db
      .select({
        day: sql<string>`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'DD Mon')`,
        daySort: sql<string>`DATE(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})))`,
        revenue: sql<string>`COALESCE(SUM(${sale_items.line_total}), 0)`,
        cogs: sql<string>`COALESCE(SUM(${sale_items.quantity} * ${products.average_cost}), 0)`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(
        and(
          eq(sales.store_id, filters.storeId),
          eq(sales.status, "COMPLETED"),
          gte(sales.created_at, start),
          lte(sales.created_at, end)
        )
      )
      .groupBy(sql`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'DD Mon')`, sql`DATE(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})))`)
      .orderBy(asc(sql`DATE(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})))`));

    return rows.map((r) => {
      const revenue = Number(r.revenue) / 100;
      const cogs = Number(r.cogs) / 100;
      const grossProfit = revenue - cogs;
      const grossMarginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;
      return { label: r.day, revenue, cogs, grossProfit, grossMarginPercent };
    });
  }

  // ─── getMonthlyTrend ────────────────────────────────────────────────────────

  async getMonthlyTrend(filters: ProfitFilters & { storeId: number }): Promise<ProfitTrendPoint[]> {
    const rows = await db
      .select({
        month: sql<string>`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'Mon YYYY')`,
        monthSort: sql<string>`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'YYYY-MM')`,
        revenue: sql<string>`COALESCE(SUM(${sale_items.line_total}), 0)`,
        cogs: sql<string>`COALESCE(SUM(${sale_items.quantity} * ${products.average_cost}), 0)`,
      })
      .from(sale_items)
      .innerJoin(sales, eq(sale_items.sale_id, sales.id))
      .innerJoin(products, eq(sale_items.product_id, products.id))
      .where(and(eq(sales.store_id, filters.storeId), eq(sales.status, "COMPLETED")))
      .groupBy(
        sql`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'Mon YYYY')`,
        sql`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'YYYY-MM')`
      )
      .orderBy(asc(sql`to_char(timezone('Asia/Kolkata', timezone('UTC', ${sales.created_at})), 'YYYY-MM')`))
      .limit(12);

    return rows.map((r) => {
      const revenue = Number(r.revenue) / 100;
      const cogs = Number(r.cogs) / 100;
      const grossProfit = revenue - cogs;
      const grossMarginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;
      return { label: r.month, revenue, cogs, grossProfit, grossMarginPercent };
    });
  }

  // ─── logCostSnapshot ────────────────────────────────────────────────────────

  async logCostSnapshot(
    productId: number,
    storeId: number,
    averageCost: number,
    tx?: any
  ): Promise<void> {
    const executor = tx || db;
    await executor.insert(product_cost_history).values({
      store_id: storeId,
      product_id: productId,
      average_cost: averageCost,
    });
  }
}
