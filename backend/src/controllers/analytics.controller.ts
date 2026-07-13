import { Request, Response, NextFunction } from "express";
import { AnalyticsService } from "../services/analytics.service";

export class AnalyticsController {
  private service: AnalyticsService;

  constructor() {
    this.service = new AnalyticsService();
  }

  getSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = (req.query.filter as string) || "thisMonth";
      const { startDate, endDate } = req.query;
      const result = await this.service.getSalesAnalytics(filter, startDate as string, endDate as string);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getProfit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = (req.query.filter as string) || "thisMonth";
      const { startDate, endDate } = req.query;
      const result = await this.service.getProfitAnalytics(filter, startDate as string, endDate as string);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getCustomerAnalytics();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getProductAnalytics();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getCashflow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getCashflow();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getForecast = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getForecast();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getInsights = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getInsights();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getKPIs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getKPIs();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
