import fs from "fs";
import path from "path";
import { settingsRepository } from "../repositories";
import { logger } from "../logger/logger";

function getPdfFilesRecursively(dir: string): { name: string; path: string; mtime: Date; size: number }[] {
  let results: any[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getPdfFilesRecursively(filePath));
    } else if (file.endsWith(".pdf")) {
      results.push({
        name: file,
        path: filePath,
        mtime: stat.mtime,
        size: stat.size,
      });
    }
  }
  return results;
}

export class PdfCleanupService {
  private storageDir = path.join(process.cwd(), "storage/invoices");

  async runCleanup(): Promise<{ deletedCount: number; totalCount: number; storageUsedMb: number }> {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        return { deletedCount: 0, totalCount: 0, storageUsedMb: 0 };
      }

      // Read retention period setting
      const period = await settingsRepository.get("pdf_retention_period", "90 Days");

      if (period === "Forever") {
        logger.info("ℹ️ PDF Retention is set to 'Forever'. Skipping storage cleanup.");
        return { deletedCount: 0, totalCount: this.getTotalPdfCount(), storageUsedMb: this.getStorageUsedMb() };
      }

      const days = parseInt(period.split(" ")[0], 10) || 90;
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(now.getDate() - days);

      // Read all files in storage/invoices recursively
      const files = getPdfFilesRecursively(this.storageDir);

      // Sort files by modification time descending (newest first)
      files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Always preserve the newest 100 generated PDFs
      const candidates = files.slice(100);

      let deletedCount = 0;
      for (const file of candidates) {
        if (file.mtime < cutoffDate) {
          try {
            fs.unlinkSync(file.path);
            deletedCount++;
          } catch (e) {
            logger.error(`❌ Failed to delete invoice PDF: ${file.name}`, e);
          }
        }
      }

      const nowIso = now.toISOString();
      logger.info(`🧹 [PDF CLEANUP] Deleted: ${deletedCount} PDFs. Current Retention Policy: ${period}. Time: ${nowIso}`);

      // Update last cleanup setting
      await settingsRepository.set("pdf_last_cleanup", nowIso);

      // Write to cleanup.log file
      const logFilePath = path.join(this.storageDir, "cleanup.log");
      const logMessage = `[${nowIso}] Policy: ${period} | Deleted: ${deletedCount} PDFs | Remaining: ${files.length - deletedCount} | Space Used: ${this.getStorageUsedMb()} MB\n`;
      fs.appendFileSync(logFilePath, logMessage);

      return {
        deletedCount,
        totalCount: files.length - deletedCount,
        storageUsedMb: this.getStorageUsedMb(),
      };
    } catch (error) {
      logger.error("❌ PDF Cleanup Service execution failed", error);
      throw error;
    }
  }

  getStorageUsedMb(): number {
    if (!fs.existsSync(this.storageDir)) return 0;
    const files = getPdfFilesRecursively(this.storageDir);
    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size;
    }
    return parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
  }

  getTotalPdfCount(): number {
    if (!fs.existsSync(this.storageDir)) return 0;
    return getPdfFilesRecursively(this.storageDir).length;
  }

  getCleanupLogs(): string[] {
    const logFilePath = path.join(this.storageDir, "cleanup.log");
    if (!fs.existsSync(logFilePath)) return [];
    try {
      const content = fs.readFileSync(logFilePath, "utf8");
      return content.trim().split("\n").slice(-15).reverse(); // return up to 15 last entries, newest first
    } catch (e) {
      return [];
    }
  }
}

export function getMsUntilKolkata2AM(): number {
  const now = new Date();

  // Get current time in Kolkata format
  const kolkataDateStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const kolkataTime = new Date(kolkataDateStr);

  const targetTime = new Date(kolkataDateStr);
  targetTime.setHours(2, 0, 0, 0);

  if (kolkataTime.getTime() >= targetTime.getTime()) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  // Return millisecond difference
  return targetTime.getTime() - kolkataTime.getTime();
}

export function schedulePdfCleanup() {
  const service = new PdfCleanupService();

  const scheduleNext = () => {
    const msUntil2AM = getMsUntilKolkata2AM();
    const next2AMSystem = new Date(Date.now() + msUntil2AM);
    logger.info(`⏰ [PDF CLEANUP] Scheduled next daily run for ${next2AMSystem.toLocaleString()} (in ${Math.round(msUntil2AM / 1000 / 60)} minutes)`);

    setTimeout(async () => {
      try {
        await service.runCleanup();
      } catch (e) {
        console.error("❌ Scheduled PDF cleanup task failed:", e);
      }
      scheduleNext(); // Recursively schedule for the next day
    }, msUntil2AM);
  };

  scheduleNext();
}
