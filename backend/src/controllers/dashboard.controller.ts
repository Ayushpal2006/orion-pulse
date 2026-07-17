import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboard.service";

export class DashboardController {
  private service: DashboardService;

  constructor() {
    this.service = new DashboardService();
  }

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getDashboardData();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      const { logger } = require("../logger/logger");
      logger.error("❌ Dashboard API Error occurred:", error);
      res.status(200).json({
        success: false,
        error: "Unable to load dashboard data.",
        data: {
          todayRevenue: 0,
          todayOrders: 0,
          todayProfit: 0,
          inventoryCount: 0,
          lowStockCount: 0,
          topProducts: [],
          recentSales: []
        }
      });
    }
  };
}
