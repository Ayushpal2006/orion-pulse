import { Request, Response, NextFunction } from "express";
import { SettingsService } from "../services/settings.service";
import path from "path";
import fs from "fs";

export class SettingsController {
  private service: SettingsService;

  constructor() {
    this.service = new SettingsService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getAllSettings();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.updateSettings(req.body);
      res.status(200).json({
        success: true,
        message: "Settings updated successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getStorageStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getStorageStatus();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  triggerCleanup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.triggerCleanup();
      res.status(200).json({
        success: true,
        message: "Storage cleanup run completed successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  backup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const backupDir = path.join(__dirname, "../../../database/backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const filename = `backup-${Date.now()}.sql`;
      const backupPath = path.join(backupDir, filename);

      await this.service.backupDatabase(backupPath);

      if (req.method === "POST") {
        res.status(200).json({
          success: true,
          message: "Database backup generated successfully",
          downloadUrl: `${req.baseUrl}/backup`
        });
        return;
      }

      res.download(backupPath, filename, (err) => {
        if (err) {
          console.error("Backup download error:", err);
        }
        try {
          fs.unlinkSync(backupPath);
        } catch (unlinkErr) {
          console.error("Failed to delete temp backup file:", unlinkErr);
        }
      });
    } catch (error: any) {
      if (req.method === "POST") {
        res.status(500).json({
          success: false,
          error: error.message || String(error)
        });
        return;
      }
      next(error);
    }
  };

  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: "No backup file uploaded",
        });
        return;
      }

      const tempPath = req.file.path;
      await this.service.restoreDatabase(tempPath, "");

      try {
        fs.unlinkSync(tempPath);
      } catch (unlinkErr) {}

      res.status(200).json({
        success: true,
        message: "Database restored successfully",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || String(error)
      });
    }
  };
}
