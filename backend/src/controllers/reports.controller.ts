import { Request, Response, NextFunction } from "express";
import { ReportsService } from "../services/reports.service";

export class ReportsController {
  private service: ReportsService;

  constructor() {
    this.service = new ReportsService();
  }

  getReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = String(req.query.filter || "last7");
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const data = await this.service.getReportsData(filter, startDate, endDate);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
