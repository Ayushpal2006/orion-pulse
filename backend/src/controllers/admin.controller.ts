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

  getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const db = require("../db").db;
      const { sql } = require("drizzle-orm");
      
      // Database size query
      const [dbSizeRow] = await db.execute(sql`SELECT pg_database_size(current_database()) AS size_bytes`);
      const dbSizeBytes = Number(dbSizeRow?.size_bytes || 0);

      // Entity counts
      const [orgsCount] = await db.execute(sql`SELECT COUNT(*) AS count FROM organizations`);
      const [storesCount] = await db.execute(sql`SELECT COUNT(*) AS count FROM stores`);
      const [usersCount] = await db.execute(sql`SELECT COUNT(*) AS count FROM users`);

      res.status(200).json({
        success: true,
        data: {
          dbSizeBytes,
          dbSizeMb: parseFloat((dbSizeBytes / (1024 * 1024)).toFixed(2)),
          organizationsCount: Number(orgsCount?.count || 0),
          storesCount: Number(storesCount?.count || 0),
          usersCount: Number(usersCount?.count || 0),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
