import { google } from "googleapis";
import db from "../database/db";

// Singleton Sync Queue Manager
export class SyncQueueManager {
  private static instance: SyncQueueManager;
  private isProcessing: boolean = false;

  private constructor() {
    // Background processing loop on start
    setTimeout(() => this.processQueue(), 5000);
  }

  static getInstance(): SyncQueueManager {
    if (!SyncQueueManager.instance) {
      SyncQueueManager.instance = new SyncQueueManager();
    }
    return SyncQueueManager.instance;
  }

  private getDbSetting(key: string, fallback: string): string {
    try {
      const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
      const row = stmt.get(key) as { value: string } | undefined;
      return row ? row.value : fallback;
    } catch (e) {
      return fallback;
    }
  }

  enqueue(jobType: string, payload: any): void {
    try {
      const stmt = db.prepare(`
        INSERT INTO sync_jobs (job_type, payload, status, retry_count)
        VALUES (?, ?, 'pending', 0)
      `);
      stmt.run(jobType, JSON.stringify(payload));
      
      // Trigger background processing asynchronously
      this.processQueue().catch(err => console.error("Error running processQueue:", err));
    } catch (error) {
      console.error("❌ Failed to enqueue sync job:", error);
    }
  }

  async getSyncStatus() {
    try {
      const totalPending = (db.prepare("SELECT COUNT(*) as count FROM sync_jobs WHERE status = 'pending'").get() as any).count;
      const totalFailed = (db.prepare("SELECT COUNT(*) as count FROM sync_jobs WHERE status = 'failed'").get() as any).count;
      const lastJob = db.prepare("SELECT updated_at FROM sync_jobs WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 1").get() as { updated_at: string } | undefined;
      
      const sheetId = this.getDbSetting("google_sheet_id", "");
      const enabled = this.getDbSetting("google_sync_enabled", "0") === "1";
      
      let status = "Green"; // Connected / Idle
      if (!sheetId) {
        status = "Red"; // Config missing
      } else if (totalFailed > 0) {
        status = "Red"; // Errors exist
      } else if (totalPending > 0) {
        status = "Yellow"; // Pending sync jobs
      }

      return {
        status,
        pendingJobs: totalPending,
        failedJobs: totalFailed,
        lastSync: lastJob ? lastJob.updated_at : "Never",
        enabled,
        sheetId
      };
    } catch (err) {
      return {
        status: "Red",
        pendingJobs: 0,
        failedJobs: 0,
        lastSync: "Never",
        enabled: false,
        sheetId: ""
      };
    }
  }

  async retryFailed(): Promise<void> {
    try {
      const stmt = db.prepare("UPDATE sync_jobs SET status = 'pending', retry_count = 0, error_message = NULL WHERE status = 'failed'");
      stmt.run();
      this.processQueue().catch(err => console.error("Error retrying queue:", err));
    } catch (err) {
      console.error("Failed to retry sync jobs:", err);
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    const enabled = this.getDbSetting("google_sync_enabled", "0") === "1";
    const sheetId = this.getDbSetting("google_sheet_id", "");
    
    if (!enabled || !sheetId) {
      return;
    }

    this.isProcessing = true;

    try {
      // Find next pending job
      const getJob = db.prepare("SELECT * FROM sync_jobs WHERE status = 'pending' ORDER BY id ASC LIMIT 1");
      const job = getJob.get() as { id: number; job_type: string; payload: string; retry_count: number } | undefined;

      if (!job) {
        this.isProcessing = false;
        return;
      }

      console.log(`🔄 Processing sync job ID ${job.id} (${job.job_type})...`);
      
      // Update job to processing or record attempt
      db.prepare("UPDATE sync_jobs SET last_attempt = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(job.id);

      const payloadObj = JSON.parse(job.payload);
      const success = await this.syncToGoogleSheets(sheetId, job.job_type, payloadObj);

      if (success) {
        db.prepare("UPDATE sync_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(job.id);
        console.log(`✅ Sync job ID ${job.id} completed successfully.`);
      } else {
        const nextRetry = job.retry_count + 1;
        const newStatus = nextRetry >= 3 ? "failed" : "pending";
        db.prepare(`
          UPDATE sync_jobs 
          SET status = ?, 
              retry_count = ?, 
              error_message = 'Failed to upload rows to Google Sheets', 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(newStatus, nextRetry, job.id);
        console.log(`⚠️ Sync job ID ${job.id} failed. Attempt ${nextRetry}/3. Status: ${newStatus}`);
      }

      // Recurse to process next items
      this.isProcessing = false;
      setTimeout(() => this.processQueue(), 1000);
    } catch (err: any) {
      console.error("Queue processor encountered error:", err);
      this.isProcessing = false;
    }
  }

  async testConnection(sheetId: string): Promise<boolean> {
    try {
      const sheets = this.getSheetsClient();
      if (!sheets) return false;
      
      await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      return true;
    } catch (e) {
      console.error("Failed to connect to spreadsheet:", e);
      return false;
    }
  }

  private getSheetsClient() {
    const email = process.env.GOOGLE_CLIENT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!email || !key) {
      console.warn("⚠️ Google credentials missing from environment variables.");
      return null;
    }

    try {
      const auth = new google.auth.JWT({
        email,
        key: key.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });
      return google.sheets({ version: "v4", auth });
    } catch (e) {
      console.error("Failed to create Google Sheets auth client:", e);
      return null;
    }
  }

  private async syncToGoogleSheets(spreadsheetId: string, jobType: string, payload: any): Promise<boolean> {
    const sheets = this.getSheetsClient();
    if (!sheets) return false;

    try {
      // 1. Ensure required tabs exist
      await this.ensureTabs(sheets, spreadsheetId);

      let tabName = "";
      let rowData: any[] = [];

      switch (jobType) {
        case "sale":
          tabName = "Sales";
          rowData = [
            payload.invoiceNumber,
            payload.date,
            payload.cashier,
            payload.paymentMethod,
            payload.subtotal,
            payload.discount,
            payload.gst,
            payload.grandTotal,
            payload.publicToken
          ];
          break;
        case "customer":
          tabName = "Customers";
          rowData = [
            payload.phone,
            payload.name,
            payload.email || "",
            payload.address || "",
            payload.total_orders || 0,
            payload.lifetime_value || 0,
            payload.last_visit || ""
          ];
          break;
        case "product":
          tabName = "Products";
          rowData = [
            payload.sku,
            payload.name,
            payload.purchase_price || 0,
            payload.selling_price || 0,
            payload.stock || 0,
            payload.gst || 18,
            payload.is_active !== undefined ? payload.is_active : 1
          ];
          break;
        default:
          return true;
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A:I`,
        valueInputOption: "RAW",
        requestBody: {
          values: [rowData]
        }
      });

      return true;
    } catch (err) {
      console.error(`Google Sheets upload failure on job ${jobType}:`, err);
      return false;
    }
  }

  private async ensureTabs(sheets: any, spreadsheetId: string) {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const existingTitles = meta.data.sheets?.map((s: any) => s.properties?.title) || [];
      
      const required = ["Sales", "Customers", "Products", "GST"];
      const addSheets = required.filter(t => !existingTitles.includes(t));
      
      if (addSheets.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: addSheets.map(title => ({
              addSheet: { properties: { title } }
            }))
          }
        });
        console.log(`Created tabs in Google Sheets: ${addSheets.join(", ")}`);
      }
    } catch (err) {
      console.warn("Failed to automatically verify/create tabs:", err);
    }
  }
}
