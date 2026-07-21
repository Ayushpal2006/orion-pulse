// Profit Engine Types — Average Cost Method (FIFO-ready architecture)

export interface ProfitFilters {
  filter?: string;           // today, yesterday, last7, last30, thisMonth, lastMonth, thisYear, custom
  startDate?: string;        // ISO date string for custom range
  endDate?: string;          // ISO date string for custom range
  productId?: number;
  category?: string;
  limit?: number;
  offset?: number;
}

/** Top-level P&L summary for dashboard cards */
export interface ProfitSummary {
  revenue: number;           // Paise
  cogs: number;              // Paise — cost of goods sold (avg cost × qty)
  grossProfit: number;       // Paise — revenue - cogs
  grossMarginPercent: number; // 0-100
  expenses: number;          // Paise — operational expenses
  netProfit: number;         // Paise — grossProfit - expenses
  netMarginPercent: number;   // 0-100
  unitsSold: number;
  invoiceCount: number;
  // Convenience INR (/ 100)
  revenue_INR: number;
  cogs_INR: number;
  grossProfit_INR: number;
  expenses_INR: number;
  netProfit_INR: number;
}

/** Per-product P&L breakdown row */
export interface ProductProfitRow {
  productId: number;
  name: string;
  sku: string;
  category: string | null;
  unitsSold: number;
  revenue: number;           // Paise
  cogs: number;              // Paise
  grossProfit: number;       // Paise
  grossMarginPercent: number;
  // Convenience INR
  revenue_INR: number;
  cogs_INR: number;
  grossProfit_INR: number;
}

/** Per-invoice P&L breakdown row */
export interface SaleProfitRow {
  saleId: number;
  invoiceNumber: string;
  date: string;
  revenue: number;           // Paise
  cogs: number;              // Paise
  grossProfit: number;       // Paise
  grossMarginPercent: number;
  revenue_INR: number;
  cogs_INR: number;
  grossProfit_INR: number;
}

/** Daily or monthly trend data point for charts */
export interface ProfitTrendPoint {
  label: string;             // e.g. "Jul 20" or "Jul 2026"
  revenue: number;           // INR (already divided)
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  expenses?: number;
  netProfit?: number;
}

/** Report sections for export */
export interface ProfitReport {
  summary: ProfitSummary;
  topProducts: ProductProfitRow[];
  bottomProducts: ProductProfitRow[];
  highestMarginProducts: ProductProfitRow[];
  lowestMarginProducts: ProductProfitRow[];
  dailyTrend: ProfitTrendPoint[];
  monthlyTrend: ProfitTrendPoint[];
}
