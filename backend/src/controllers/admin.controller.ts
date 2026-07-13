import { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service";
import { logger } from "../logger/logger";

export class AdminController {
  private service: AdminService;

  constructor() {
    this.service = new AdminService();
  }

  resetDemoData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      logger.info("Admin Controller: POST /api/admin/reset-demo-data triggered");
      const summary = await this.service.resetDemoData();
      
      res.status(200).json({
        success: true,
        message: "Factory Reset complete. All demo and transactional data has been successfully deleted.",
        data: summary,
      });
    } catch (error) {
      logger.error("Admin Controller: Factory Reset failed", error);
      next(error);
    }
  };
}
