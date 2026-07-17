import { DatabaseAdapter } from "../../database";

export interface IReportsRepository {
  getSummary(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid?: boolean,
    tx?: DatabaseAdapter
  ): Promise<{
    revenue: number;
    orders: number;
    profit: number;
    averageOrderValue: number;
  }>;
  getTopProducts(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid?: boolean,
    tx?: DatabaseAdapter
  ): Promise<any[]>;
  getGstSummary(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid?: boolean,
    tx?: DatabaseAdapter
  ): Promise<any[]>;
  getPaymentSplit(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid?: boolean,
    tx?: DatabaseAdapter
  ): Promise<Record<string, number>>;
  getTrendSeries(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid?: boolean,
    tx?: DatabaseAdapter
  ): Promise<any[]>;
  getRecentInvoices(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid?: boolean,
    tx?: DatabaseAdapter
  ): Promise<any[]>;
  getTopCustomers(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid?: boolean,
    tx?: DatabaseAdapter
  ): Promise<any[]>;
  getLowStockCount(tx?: DatabaseAdapter): Promise<number>;
  getProductsSummary(
    filter: string,
    startDate?: string,
    endDate?: string,
    showVoid?: boolean,
    tx?: DatabaseAdapter
  ): Promise<{
    totalUnitsSold: number;
    totalRevenue: number;
    uniqueProductsSold: number;
  }>;
}
