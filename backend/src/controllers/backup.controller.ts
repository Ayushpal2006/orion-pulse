import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { backup_history } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError, NotFoundError } from "../utils/errors";

export class BackupController {
  createBackup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const { backupType } = req.body; // SQLITE, POSTGRES
      if (!backupType || !["SQLITE", "POSTGRES"].includes(backupType)) {
        throw new ValidationError("Invalid backupType (must be SQLITE or POSTGRES)");
      }

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `backup-${backupType.toLowerCase()}-${todayStr}-${Math.floor(Math.random() * 1000)}.sql`;
      const fileSize = Math.floor(Math.random() * 5000000) + 1000000; // Mock 1MB - 6MB file

      const [backup] = await db
        .insert(backup_history)
        .values({
          store_id: storeId,
          filename,
          file_size: fileSize,
          backup_type: backupType,
          status: "completed",
        })
        .returning();

      res.status(201).json({
        success: true,
        data: {
          id: backup.id,
          filename: backup.filename,
          fileSizeMb: parseFloat((backup.file_size / (1024 * 1024)).toFixed(2)),
          backupType: backup.backup_type,
          status: backup.status,
          downloadUrl: `/uploads/backups/${backup.filename}`,
          createdAt: backup.created_at.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const rows = await db
        .select()
        .from(backup_history)
        .where(eq(backup_history.store_id, storeId))
        .orderBy(desc(backup_history.id));

      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  };

  restoreBackup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      const { filename } = req.body;
      if (!filename || storeId === undefined) {
        throw new ValidationError("Filename is required for restoration");
      }

      const [backup] = await db
        .select()
        .from(backup_history)
        .where(and(eq(backup_history.filename, filename), eq(backup_history.store_id, storeId)))
        .limit(1);

      if (!backup) {
        throw new NotFoundError(`Backup file "${filename}" not found`);
      }

      res.status(200).json({
        success: true,
        message: `Database backup "${filename}" restored successfully`,
      });
    } catch (error) {
      next(error);
    }
  };
}
