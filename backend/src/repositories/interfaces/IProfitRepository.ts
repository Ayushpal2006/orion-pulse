import type {
  ProfitFilters,
  ProfitSummary,
  ProductProfitRow,
  SaleProfitRow,
  ProfitTrendPoint,
} from "../../types/profit.types";

export interface IProfitRepository {
  /** Aggregated P&L summary for the given period */
  getSummary(filters: ProfitFilters): Promise<ProfitSummary>;

  /** Per-product P&L breakdown, ordered by gross profit desc */
  getProductBreakdown(filters: ProfitFilters): Promise<ProductProfitRow[]>;

  /** Per-invoice P&L breakdown */
  getSaleBreakdown(filters: ProfitFilters): Promise<SaleProfitRow[]>;

  /** Daily trend data points (last N days or filtered range) */
  getDailyTrend(filters: ProfitFilters): Promise<ProfitTrendPoint[]>;

  /** Monthly trend data points */
  getMonthlyTrend(filters: ProfitFilters): Promise<ProfitTrendPoint[]>;

  /** Log a cost snapshot to product_cost_history (called on purchase create/update) */
  logCostSnapshot(
    productId: number,
    storeId: number,
    averageCost: number,
    tx?: any
  ): Promise<void>;
}
