import { google } from "googleapis";
import { syncRepository, settingsRepository } from "../repositories";
import { logger } from "../logger/logger";
import { formatInTimeZone } from "date-fns-tz";

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

  enqueue(jobType: string, payload: any): void {
    syncRepository.enqueue(jobType, payload)
      .then(() => this.processQueue())
      .catch((err) => console.error("❌ Failed to enqueue sync job:", err));
  }

  async getSyncStatus() {
    try {
      const stats = await syncRepository.getStats();
      const sheetId = await settingsRepository.get("google_sheet_id", "");
      const enabled = (await settingsRepository.get("google_sync_enabled", "0")) === "1";
      const serviceAccount = process.env.GOOGLE_CLIENT_EMAIL || "Not Configured";
      
      let status = "Green"; // Connected / Idle
      if (!sheetId) {
        status = "Red"; // Config missing
      } else if (stats.failedJobs > 0) {
        status = "Red"; // Errors exist
      } else if (stats.pendingJobs > 0) {
        status = "Yellow"; // Pending sync jobs
      }

      return {
        status,
        pendingJobs: stats.pendingJobs,
        failedJobs: stats.failedJobs,
        lastSync: stats.lastSync,
        enabled,
        sheetId,
        serviceAccount
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
      await syncRepository.retryFailedJobs();
      this.processQueue().catch((err) => console.error("Error retrying queue:", err));
    } catch (err) {
      console.error("Failed to retry sync jobs:", err);
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    const enabled = (await settingsRepository.get("google_sync_enabled", "0")) === "1";
    const sheetId = await settingsRepository.get("google_sheet_id", "");
    
    if (!enabled || !sheetId) {
      return;
    }

    this.isProcessing = true;

    try {
      // Find next pending job
      const job = await syncRepository.getPendingJob();

      if (!job) {
        this.isProcessing = false;
        return;
      }

      logger.info(`🔄 Processing sync job ID ${job.id} (${job.job_type})...`);
      
      // Update job to record attempt
      await syncRepository.recordJobAttempt(job.id);

      const payloadObj = JSON.parse(job.payload);
      const result = await this.syncToGoogleSheets(sheetId, job.job_type, payloadObj);

      if (result.success) {
        await syncRepository.updateJobStatus(job.id, "completed", job.retry_count);
        logger.info(`✅ Sync job ID ${job.id} completed successfully.`);
      } else {
        const nextRetry = job.retry_count + 1;
        const newStatus = nextRetry >= 3 ? "failed" : "pending";
        await syncRepository.updateJobStatus(
          job.id,
          newStatus,
          nextRetry,
          result.error || "Failed to upload rows to Google Sheets"
        );
        logger.warn(`⚠️ Sync job ID ${job.id} failed. Attempt ${nextRetry}/3. Status: ${newStatus}. Error: ${result.error}`);
      }

      // Recurse to process next items
      this.isProcessing = false;
      setTimeout(() => this.processQueue(), 1000);
    } catch (err: any) {
      logger.error("Queue processor encountered error", err);
      this.isProcessing = false;
    }
  }

  async testConnection(sheetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sheets = this.getSheetsClient();
      if (!sheets) {
        return { success: false, error: "Google Service Account credentials are not configured in backend .env file." };
      }
      await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      return { success: true };
    } catch (e: any) {
      console.error("Failed to connect to spreadsheet:", e);
      let errorMsg = e.message || String(e);
      if (e.status === 403 || (e.message && e.message.includes("permission"))) {
        errorMsg = "Permission Denied. Please share the Google Sheet with the Service Account email address as an 'Editor'.";
      } else if (e.status === 404 || (e.message && e.message.includes("not found"))) {
        errorMsg = "Spreadsheet not found. Please verify the Google Sheet ID is correct.";
      }
      return { success: false, error: errorMsg };
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

  private async syncToGoogleSheets(spreadsheetId: string, jobType: string, payload: any): Promise<{ success: boolean; error?: string }> {
    const sheets = this.getSheetsClient();
    if (!sheets) return { success: false, error: "Google credentials missing or invalid." };

    const formatKolkataDateTime = (dateVal: any): string => {
      if (!dateVal) return "";
      try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return formatInTimeZone(d, "Asia/Kolkata", "yyyy-MM-dd hh:mm a");
      } catch (e) {
        return String(dateVal);
      }
    };

    try {
      // 1. Ensure required tabs exist
      await this.ensureTabs(sheets, spreadsheetId);

      let tabName = "";
      let rowData: any[] = [];
      let uniqueKey: string | null = null;
      const keyColIndex = 0; // Column A is always index 0 (SKU/Phone)

      switch (jobType) {
        case "sale":
          tabName = "Sales";
          rowData = [
            payload.invoiceNumber ?? "",
            `${payload.date ?? ""} ${payload.time ?? ""}`.trim(),
            payload.cashier ?? "System",
            payload.paymentMethod ?? "",
            Number(payload.subtotal ?? 0),
            Number(payload.discount ?? 0),
            Number(payload.gst ?? 0),
            Number(payload.grandTotal ?? 0),
            payload.publicToken ?? "",
            payload.status ?? "COMPLETED",
            payload.voidReason ?? "",
            payload.voidDate ?? "",
            payload.voidTime ?? "",
            payload.voidBy ?? ""
          ];
          uniqueKey = payload.invoiceNumber ?? "";
          break;
        case "customer":
          tabName = "Customers";
          rowData = [
            payload.phone ?? "",
            payload.name ?? "",
            payload.email ?? "",
            payload.address ?? "",
            Number(payload.total_orders ?? 0),
            Number(payload.lifetime_value ?? 0) / 100.0,
            formatKolkataDateTime(payload.last_visit),
            payload.is_active !== undefined && payload.is_active !== null ? payload.is_active : 1
          ];
          uniqueKey = payload.phone ?? "";
          break;
        case "product":
          tabName = "Products";
          rowData = [
            payload.sku ?? "",
            payload.name ?? "",
            Number(payload.purchase_price ?? 0) / 100.0,
            Number(payload.selling_price ?? 0) / 100.0,
            Number(payload.stock ?? 0),
            Number(payload.gst ?? 18),
            payload.is_active !== undefined && payload.is_active !== null ? payload.is_active : 1
          ];
          uniqueKey = payload.sku ?? "";
          break;
        default:
          return { success: true };
      }

      if (uniqueKey && String(uniqueKey).trim() !== "") {
        // Query the sheets tab to see if record already exists
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${tabName}'!A:H`,
        });
        
        const rows = res.data.values || [];
        let existingRowIndex = -1;
        
        const targetKey = String(uniqueKey).trim();
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i][keyColIndex] !== undefined && String(rows[i][keyColIndex]).trim() === targetKey) {
            existingRowIndex = i + 1; // Sheets are 1-indexed
            break;
          }
        }

        if (existingRowIndex !== -1) {
          // Update the matching row in-place
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tabName}'!A${existingRowIndex}`,
            valueInputOption: "RAW",
            requestBody: {
              values: [rowData]
            }
          });
          logger.info(`📝 Google Sheets: Updated row ${existingRowIndex} in tab "${tabName}" for key: ${uniqueKey}`);
          return { success: true };
        }
      }

      // If it doesn't exist or is a transaction (like sale), append a new row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${tabName}'!A:I`,
        valueInputOption: "RAW",
        requestBody: {
          values: [rowData]
        }
      });
      logger.info(`➕ Google Sheets: Appended new row in tab "${tabName}"`);
      return { success: true };
    } catch (err: any) {
      console.error(`Google Sheets upload failure on job ${jobType}:`, err);
      return { success: false, error: err.message || String(err) };
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
        logger.info(`Created tabs in Google Sheets: ${addSheets.join(", ")}`);

        // Add headers for each created tab
        for (const title of addSheets) {
          let headers: string[] = [];
          if (title === "Sales") {
            headers = ["Invoice Number", "Date & Time", "Cashier", "Payment Method", "Subtotal", "Discount", "GST", "Grand Total", "Public Link", "Status", "Void Reason", "Void Date", "Void Time", "Void By"];
          } else if (title === "Customers") {
            headers = ["Phone", "Name", "Email", "Address", "Total Orders", "Lifetime Value (INR)", "Last Visit", "Active Status"];
          } else if (title === "Products") {
            headers = ["SKU", "Name", "Purchase Price (INR)", "Selling Price (INR)", "Stock", "GST (%)", "Active Status"];
          } else if (title === "GST") {
            headers = ["GST Slab", "Taxable Value (INR)", "Tax Collected (INR)"];
          }

          if (headers.length > 0) {
            await sheets.spreadsheets.values.append({
              spreadsheetId,
              range: `${title}!A1`,
              valueInputOption: "RAW",
              requestBody: {
                values: [headers]
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to automatically verify/create tabs:", err);
    }
  }
}
