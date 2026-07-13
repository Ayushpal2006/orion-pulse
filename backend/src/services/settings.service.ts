import { settingsRepository } from "../repositories";
import { PdfCleanupService, getMsUntilKolkata2AM } from "./pdf-cleanup.service";
import { PostgresBackupProvider } from "../storage/postgres-backup.provider";
import { databaseConfig } from "../config/database";

export class SettingsService {
  private pdfCleanupService: PdfCleanupService;

  constructor() {
    this.pdfCleanupService = new PdfCleanupService();
  }

  async getAllSettings(): Promise<Record<string, string>> {
    return settingsRepository.getAll();
  }

  async updateSettings(settings: Record<string, string>): Promise<void> {
    await settingsRepository.setMany(settings);
  }

  async getStorageStatus(): Promise<any> {
    const totalPdfs = this.pdfCleanupService.getTotalPdfCount();
    const storageUsedMb = this.pdfCleanupService.getStorageUsedMb();
    const cleanupLogs = this.pdfCleanupService.getCleanupLogs();

    const retention = await settingsRepository.get("pdf_retention_period", "90 Days");
    const lastCleanup = await settingsRepository.get("pdf_last_cleanup", "Never");

    const msUntil2AM = getMsUntilKolkata2AM();
    const nextCleanupDate = new Date(Date.now() + msUntil2AM);

    return {
      totalPdfs,
      storageUsedMb,
      retentionPeriod: retention,
      lastCleanup,
      nextCleanup: nextCleanupDate.toISOString(),
      cleanupLogs,
    };
  }

  async triggerCleanup(): Promise<any> {
    return this.pdfCleanupService.runCleanup();
  }

  private getBackupProvider() {
    return new PostgresBackupProvider();
  }

  async backupDatabase(backupPath: string): Promise<void> {
    const provider = this.getBackupProvider();
    await provider.backup(backupPath);
  }

  async restoreDatabase(tempPath: string, targetPath: string): Promise<void> {
    const provider = this.getBackupProvider();
    await provider.restore(tempPath);
  }
}
