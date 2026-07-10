import { Router, Request, Response } from "express";
import db from "../database/db";
import path from "path";
import fs from "fs";
import multer from "multer";

const router = Router();

// Configure multer for database uploads
const tempDir = path.join(__dirname, "../../uploads/temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
const upload = multer({ dest: tempDir });

router.get("/", (req: Request, res: Response): void => {
  try {
    const stmt = db.prepare("SELECT * FROM settings");
    const rows = stmt.all() as { key: string; value: string }[];
    const settingsObj: Record<string, string> = {};
    for (const row of rows) {
      settingsObj[row.key] = row.value;
    }
    res.status(200).json({
      success: true,
      data: settingsObj,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/", (req: Request, res: Response): void => {
  const body = req.body;
  const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  
  const transaction = db.transaction((settingsObj) => {
    for (const [key, value] of Object.entries(settingsObj)) {
      stmt.run(key, String(value ?? ""));
    }
  });

  transaction(body);

  res.status(200).json({
    success: true,
    message: "Settings synchronized successfully",
  });
});

// GET storage status stats
router.get("/storage", async (req: Request, res: Response): Promise<void> => {
  try {
    const { PdfCleanupService, getMsUntilKolkata2AM } = require("../services/pdf-cleanup.service");
    const service = new PdfCleanupService();
    const totalPdfs = service.getTotalPdfCount();
    const storageUsedMb = service.getStorageUsedMb();
    const cleanupLogs = service.getCleanupLogs();

    const retentionRow = db.prepare("SELECT value FROM settings WHERE key = 'pdf_retention_period'").get() as { value: string } | undefined;
    const lastCleanupRow = db.prepare("SELECT value FROM settings WHERE key = 'pdf_last_cleanup'").get() as { value: string } | undefined;

    const retention = retentionRow ? retentionRow.value : "90 Days";
    const lastCleanup = lastCleanupRow ? lastCleanupRow.value : "Never";

    // Calculate next cleanup run (next 2:00 AM Kolkata time)
    const msUntil2AM = getMsUntilKolkata2AM();
    const nextCleanupDate = new Date(Date.now() + msUntil2AM);

    res.status(200).json({
      success: true,
      data: {
        totalPdfs,
        storageUsedMb,
        retentionPeriod: retention,
        lastCleanup,
        nextCleanup: nextCleanupDate.toISOString(),
        cleanupLogs,
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST trigger manual PDF cleanup
router.post("/storage/cleanup", async (req: Request, res: Response): Promise<void> => {
  try {
    const { PdfCleanupService } = require("../services/pdf-cleanup.service");
    const service = new PdfCleanupService();
    const result = await service.runCleanup();
    res.status(200).json({
      success: true,
      message: `Manual storage cleanup completed. Deleted ${result.deletedCount} old PDF invoices.`,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET database backup file download
router.get("/database/backup", async (req: Request, res: Response): Promise<void> => {
  try {
    const backupPath = path.join(__dirname, "../../database/orion_backup.db");
    
    // SQLite online backup API via better-sqlite3
    await db.backup(backupPath);
    
    res.download(backupPath, "orion-backup.db", (err) => {
      if (fs.existsSync(backupPath)) {
        try {
          fs.unlinkSync(backupPath);
        } catch (e) {}
      }
    });
  } catch (error: any) {
    console.error("Database backup failed:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST restore database file upload
router.post("/database/restore", upload.single("database"), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: "No database backup file uploaded."
      });
      return;
    }

    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, "../../database/orion.db");

    // Close SQLite connection prior to file swap
    const { closeAndReopenDb } = require("../database/db");
    closeAndReopenDb();

    // Overwrite database file
    fs.copyFileSync(tempPath, targetPath);
    
    // Clean up temporary upload file
    try {
      fs.unlinkSync(tempPath);
    } catch (e) {}

    // Reopen database connection
    closeAndReopenDb();

    res.status(200).json({
      success: true,
      message: "Database successfully restored from backup. POS re-initialized."
    });
  } catch (error: any) {
    console.error("Database restore failed:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
