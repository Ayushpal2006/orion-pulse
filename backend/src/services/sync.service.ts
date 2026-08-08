import { syncRepository, settingsRepository } from "../repositories";
import { logger } from "../logger/logger";
import { formatInTimeZone } from "date-fns-tz";
import { storeStorage, getTenantContext } from "../db/context";
import { db } from "../db";
import { stores, google_integrations } from "../db/schema";
import { eq } from "drizzle-orm";
import { decryptToken } from "../utils/crypto";
import { GoogleProvisioningService } from "./google-provisioning.service";

// Lazy-load googleapis to avoid heavy top-level startup delay
let googleApiCache: any = null;
function getGoogleApi() {
  if (!googleApiCache) {
    googleApiCache = require("googleapis").google;
  }
  return googleApiCache;
}

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
    this.isProcessing = true;

    try {
      // Find next pending job across tenants
      const job = await syncRepository.getPendingJob();

      if (!job) {
        this.isProcessing = false;
        return;
      }

      const targetStoreId = job.store_id || 1;
      let targetOrgId = job.organization_id || 0;

      if (!targetOrgId || targetOrgId <= 0) {
        const [st] = await db
          .select({ organization_id: stores.organization_id })
          .from(stores)
          .where(eq(stores.id, targetStoreId))
          .limit(1);
        targetOrgId = st?.organization_id || 0;
      }

      await storeStorage.run(
        {
          organizationId: targetOrgId,
          currentStoreId: targetStoreId,
          userId: 0,
          role: "system",
        },
        async () => {
          logger.info(`🔄 Processing sync job ID ${job.id} (${job.job_type}) for Org ${targetOrgId} / Store ${targetStoreId}...`);
          await syncRepository.recordJobAttempt(job.id);

          const payloadObj = JSON.parse(job.payload);

          // NON-NEGOTIABLE TENANT MATCH GUARANTEE (Run FIRST before any external client resolution)
          if (payloadObj.organization_id && Number(payloadObj.organization_id) !== targetOrgId) {
            const errStr = `[TENANT MISMATCH ABORT] Payload org (${payloadObj.organization_id}) does not match target org (${targetOrgId})`;
            logger.error(`❌ ${errStr}`);
            await syncRepository.updateJobStatus(job.id, "failed", 3, errStr);
            return;
          }
          if (payloadObj.store_id && Number(payloadObj.store_id) !== targetStoreId) {
            const errStr = `[TENANT MISMATCH ABORT] Payload store (${payloadObj.store_id}) does not match target store (${targetStoreId})`;
            logger.error(`❌ ${errStr}`);
            await syncRepository.updateJobStatus(job.id, "failed", 3, errStr);
            return;
          }

          const enabled = (await settingsRepository.get("google_sync_enabled", "0")) === "1";
          const sheetId = await settingsRepository.get("google_sheet_id", "");

          // Resolve Sheets Client and Target Spreadsheet based on tenant sync method (OAuth vs Service Account)
          const { sheets, spreadsheetId: resolvedSheetId, syncMethod, integrationId } =
            await this.resolveSheetsClientAndSpreadsheet(targetOrgId, sheetId);

          if (!enabled || !resolvedSheetId || !sheets) {
            logger.info(`ℹ️ Sync skipped for job ID ${job.id}: Google sync disabled or missing credentials/sheet ID for store ${targetStoreId}.`);
            await syncRepository.updateJobStatus(
              job.id,
              "failed",
              job.retry_count + 1,
              "Google Sheets sync is disabled or credentials/spreadsheet ID are missing for this tenant."
            );
            return;
          }

          const result = await this.syncToGoogleSheetsWithClient(sheets, resolvedSheetId, job.job_type, payloadObj, targetOrgId, targetStoreId);

          if (result.success) {
            await syncRepository.updateJobStatus(job.id, "completed", job.retry_count);
            logger.info(`✅ Sync job ID ${job.id} completed successfully via ${syncMethod.toUpperCase()} for Org ${targetOrgId} / Store ${targetStoreId}.`);
            if (integrationId) {
              await db
                .update(google_integrations)
                .set({ last_sync: new Date(), updated_at: new Date() })
                .where(eq(google_integrations.id, integrationId));
            }
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
        }
      );

      this.isProcessing = false;
      setTimeout(() => this.processQueue(), 1000);
    } catch (err: any) {
      this.isProcessing = false;
    }
  }

  async testConnection(sheetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { organizationId } = getTenantContext();
      let sheets: any = null;
      let targetSheetId = sheetId;

      if (organizationId && organizationId > 0) {
        const res = await this.resolveSheetsClientAndSpreadsheet(organizationId, sheetId);
        sheets = res.sheets;
        if (res.spreadsheetId) targetSheetId = res.spreadsheetId;
      }
      if (!sheets) {
        sheets = this.getSheetsClient();
      }

      if (!sheets) {
        return { success: false, error: "Google credentials are not configured for backend." };
      }
      await sheets.spreadsheets.get({ spreadsheetId: targetSheetId });
      return { success: true };
    } catch (e: any) {
      console.error("Failed to connect to spreadsheet:", e);
      let errorMsg = e.message || String(e);
      if (e.status === 403 || (e.message && e.message.includes("permission"))) {
        errorMsg = "Permission Denied. Please ensure the Google Sheet is shared with Editor access.";
      } else if (e.status === 404 || (e.message && e.message.includes("not found"))) {
        errorMsg = "Spreadsheet not found. Please verify the Google Sheet ID is correct.";
      }
      return { success: false, error: errorMsg };
    }
  }

  private async resolveSheetsClientAndSpreadsheet(orgId: number, fallbackSheetId: string) {
    const syncMethod = await settingsRepository.get("google_sync_method", "oauth");

    if (syncMethod === "oauth" && orgId > 0) {
      const [integration] = await db
        .select()
        .from(google_integrations)
        .where(eq(google_integrations.organization_id, orgId))
        .limit(1);

      if (integration && integration.refresh_token && integration.sync_enabled === 1) {
        const refreshToken = decryptToken(integration.refresh_token);
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (clientId && clientSecret && refreshToken) {
          try {
            const google = getGoogleApi();
            const auth = new google.auth.OAuth2(clientId, clientSecret);
            auth.setCredentials({ refresh_token: refreshToken });
            const sheets = google.sheets({ version: "v4", auth });
            const targetSheetId = integration.spreadsheet_id || fallbackSheetId;
            return { sheets, spreadsheetId: targetSheetId, syncMethod: "oauth", integrationId: integration.id };
          } catch (err) {
            logger.warn("Failed to initialize Google OAuth2 client for tenant: " + String(err));
          }
        }
      }
    }

    // Fallback to Service Account flow
    const sheets = this.getSheetsClient();
    return { sheets, spreadsheetId: fallbackSheetId, syncMethod: "service_account", integrationId: null };
  }

  private getSheetsClient() {
    const email = process.env.GOOGLE_CLIENT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!email || !key) {
      console.warn("⚠️ Google Service Account credentials missing from environment variables.");
      return null;
    }

    try {
      const google = getGoogleApi();
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

  private async syncToGoogleSheetsWithClient(
    sheets: any,
    spreadsheetId: string,
    jobType: string,
    payload: any,
    expectedOrgId?: number,
    expectedStoreId?: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!sheets) return { success: false, error: "Google Sheets client missing or invalid." };

    // STRICT NON-NEGOTIABLE TENANT ISOLATION CHECK
    const { organizationId, currentStoreId } = getTenantContext();
    if (expectedOrgId && expectedOrgId > 0 && organizationId > 0 && organizationId !== expectedOrgId) {
      const err = `Tenant context org (${organizationId}) does not match expected org (${expectedOrgId})`;
      logger.error(`❌ [TENANT ISOLATION ABORT] ${err}`);
      return { success: false, error: err };
    }
    if (expectedStoreId && expectedStoreId > 0 && currentStoreId > 0 && currentStoreId !== expectedStoreId) {
      const err = `Tenant context store (${currentStoreId}) does not match expected store (${expectedStoreId})`;
      logger.error(`❌ [TENANT ISOLATION ABORT] ${err}`);
      return { success: false, error: err };
    }

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
        case "inventory_movement":
          tabName = "Inventory Movements";
          rowData = [
            payload.created_at ? formatInTimeZone(new Date(payload.created_at), "Asia/Kolkata", "yyyy-MM-dd") : "",
            payload.created_at ? formatInTimeZone(new Date(payload.created_at), "Asia/Kolkata", "hh:mm a") : "",
            payload.product_name ?? String(payload.product_id),
            payload.movement_type ?? "",
            payload.reference_id ?? "",
            Number(payload.quantity ?? 0),
            Number(payload.previous_stock ?? 0),
            Number(payload.new_stock ?? 0),
            payload.reason ?? "",
          ];
          uniqueKey = null;
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
      await GoogleProvisioningService.provisionSpreadsheet(sheets, spreadsheetId);
    } catch (err: any) {
      console.warn("Failed to automatically verify/provision tabs:", err.message || err);
    }
  }
}
