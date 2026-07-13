import { DatabaseAdapter } from "../../database";

export interface IDashboardRepository {
  getTodaySummary(tx?: DatabaseAdapter): Promise<{
    todayRevenue: number;
    todayOrders: number;
    todayProfit: number;
    inventoryCount: number;
    lowStockCount: number;
  }>;
  getTopProducts(tx?: DatabaseAdapter): Promise<any[]>;
  getRecentSales(tx?: DatabaseAdapter): Promise<any[]>;
}
