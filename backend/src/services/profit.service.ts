import { profitRepository } from "../repositories";
import { getStoreId } from "../db/context";
import { ValidationError } from "../utils/errors";
import type {
  ProfitFilters,
  ProfitSummary,
  ProductProfitRow,
  SaleProfitRow,
  ProfitTrendPoint,
  ProfitReport,
} from "../types/profit.types";

export class ProfitService {
  // ─── Helpers ───────────────────────────────────────────────────────────────

  private requireStore(): number {
    const storeId = getStoreId();
    if (storeId === undefined) throw new ValidationError("Store context is required");
    return storeId;
  }

  private buildFilters(rawFilters: ProfitFilters): ProfitFilters & { storeId: number } {
    return {
      filter: rawFilters.filter || "last30",
      startDate: rawFilters.startDate,
      endDate: rawFilters.endDate,
      productId: rawFilters.productId,
      category: rawFilters.category,
      limit: rawFilters.limit,
      offset: rawFilters.offset,
      storeId: this.requireStore(),
    };
  }

  // ─── Summary (dashboard KPIs) ──────────────────────────────────────────────

  async getSummary(rawFilters: ProfitFilters = {}): Promise<ProfitSummary> {
    return profitRepository.getSummary(this.buildFilters(rawFilters) as any);
  }

  // ─── Today + Monthly summary convenience ─────────────────────────────────

  async getDashboardStats(): Promise<{
    today: ProfitSummary;
    thisMonth: ProfitSummary;
    lastMonth: ProfitSummary;
  }> {
    const storeId = this.requireStore();
    const [today, thisMonth, lastMonth] = await Promise.all([
      profitRepository.getSummary({ filter: "today", storeId } as any),
      profitRepository.getSummary({ filter: "thisMonth", storeId } as any),
      profitRepository.getSummary({ filter: "lastMonth", storeId } as any),
    ]);
    return { today, thisMonth, lastMonth };
  }

  // ─── Product Breakdown ────────────────────────────────────────────────────

  async getProductProfitReport(rawFilters: ProfitFilters = {}): Promise<ProductProfitRow[]> {
    return profitRepository.getProductBreakdown(this.buildFilters(rawFilters) as any);
  }

  /** Top N most profitable products */
  async getTopProfitableProducts(rawFilters: ProfitFilters = {}, n = 10): Promise<ProductProfitRow[]> {
    const rows = await this.getProductProfitReport({ ...rawFilters, limit: n });
    return rows.sort((a, b) => b.grossProfit - a.grossProfit).slice(0, n);
  }

  /** Bottom N least profitable products */
  async getLeastProfitableProducts(rawFilters: ProfitFilters = {}, n = 10): Promise<ProductProfitRow[]> {
    const rows = await this.getProductProfitReport({ ...rawFilters, limit: 100 });
    return rows.sort((a, b) => a.grossProfit - b.grossProfit).slice(0, n);
  }

  /** Top N products by gross margin % */
  async getHighestMarginProducts(rawFilters: ProfitFilters = {}, n = 10): Promise<ProductProfitRow[]> {
    const rows = await this.getProductProfitReport({ ...rawFilters, limit: 100 });
    return rows.sort((a, b) => b.grossMarginPercent - a.grossMarginPercent).slice(0, n);
  }

  /** Bottom N products by gross margin % */
  async getLowestMarginProducts(rawFilters: ProfitFilters = {}, n = 10): Promise<ProductProfitRow[]> {
    const rows = await this.getProductProfitReport({ ...rawFilters, limit: 100 });
    return rows.sort((a, b) => a.grossMarginPercent - b.grossMarginPercent).slice(0, n);
  }

  /** Top N best selling products by units sold */
  async getBestSellingProducts(rawFilters: ProfitFilters = {}, n = 10): Promise<ProductProfitRow[]> {
    const rows = await this.getProductProfitReport({ ...rawFilters, limit: 100 });
    return rows.sort((a, b) => b.unitsSold - a.unitsSold).slice(0, n);
  }

  // ─── Sale Breakdown ───────────────────────────────────────────────────────

  async getSaleProfitReport(rawFilters: ProfitFilters = {}): Promise<SaleProfitRow[]> {
    return profitRepository.getSaleBreakdown(this.buildFilters(rawFilters) as any);
  }

  // ─── Trends ──────────────────────────────────────────────────────────────

  async getDailyTrend(rawFilters: ProfitFilters = {}): Promise<ProfitTrendPoint[]> {
    return profitRepository.getDailyTrend(this.buildFilters(rawFilters) as any);
  }

  async getMonthlyTrend(rawFilters: ProfitFilters = {}): Promise<ProfitTrendPoint[]> {
    return profitRepository.getMonthlyTrend(this.buildFilters(rawFilters) as any);
  }

  // ─── Full Report (for export) ─────────────────────────────────────────────

  async getFullReport(rawFilters: ProfitFilters = {}): Promise<ProfitReport> {
    const filters = this.buildFilters(rawFilters);
    const [
      summary,
      allProducts,
      dailyTrend,
      monthlyTrend,
    ] = await Promise.all([
      profitRepository.getSummary(filters as any),
      profitRepository.getProductBreakdown({ ...filters, limit: 200 } as any),
      profitRepository.getDailyTrend(filters as any),
      profitRepository.getMonthlyTrend(filters as any),
    ]);

    const sorted = [...allProducts];
    const topProducts = [...sorted].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 10);
    const bottomProducts = [...sorted].sort((a, b) => a.grossProfit - b.grossProfit).slice(0, 10);
    const highestMarginProducts = [...sorted].sort((a, b) => b.grossMarginPercent - a.grossMarginPercent).slice(0, 10);
    const lowestMarginProducts = [...sorted].sort((a, b) => a.grossMarginPercent - b.grossMarginPercent).slice(0, 10);

    return {
      summary,
      topProducts,
      bottomProducts,
      highestMarginProducts,
      lowestMarginProducts,
      dailyTrend,
      monthlyTrend,
    };
  }

  // ─── Cost Snapshot (called by PurchaseService) ────────────────────────────

  async logCostSnapshot(
    productId: number,
    averageCost: number,
    tx?: any
  ): Promise<void> {
    const storeId = this.requireStore();
    await profitRepository.logCostSnapshot(productId, storeId, averageCost, tx);
  }
}
