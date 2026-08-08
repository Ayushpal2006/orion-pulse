import { google } from "googleapis";
import { db } from "../db";
import { google_integrations } from "../db/schema";
import { eq } from "drizzle-orm";
import { decryptToken } from "../utils/crypto";
import { logger } from "../logger/logger";
import { GoogleProvisioningService } from "./google-provisioning.service";
import { formatInTimeZone } from "date-fns-tz";

export type GoogleSyncEventType =
  | "SALE_CREATED"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_ARCHIVED"
  | "CUSTOMER_CREATED"
  | "CUSTOMER_UPDATED"
  | "SUPPLIER_CREATED"
  | "PURCHASE_CREATED"
  | "EXPENSE_CREATED"
  | "INVENTORY_ADJUSTED";

export interface TenantSyncContext {
  organizationId: number;
  storeId?: number;
}

export class GoogleSyncDispatcher {
  /**
   * Non-blocking entry point to dispatch a Google sync event.
   * Business services call this fire-and-forget style AFTER DB commit.
   */
  static dispatchSyncEvent(
    eventType: GoogleSyncEventType,
    payload: Record<string, any>,
    context: TenantSyncContext
  ): void {
    // Fire-and-forget async execution (never blocks HTTP response or DB transaction)
    setImmediate(async () => {
      try {
        await this.executeSyncWithRetry(eventType, payload, context);
      } catch (err: any) {
        logger.error(`❌ GoogleSyncDispatcher uncaught error for event ${eventType}: ${err.message}`);
      }
    });
  }

  /**
   * Internal retry loop: Attempts execution up to 3 times with exponential backoff.
   */
  private static async executeSyncWithRetry(
    eventType: GoogleSyncEventType,
    payload: Record<string, any>,
    context: TenantSyncContext,
    maxRetries = 3
  ): Promise<boolean> {
    const startTime = Date.now();
    const orgId = context.organizationId;

    if (!orgId || orgId <= 0) {
      logger.info(`ℹ️ GoogleSyncDispatcher: Skipped event ${eventType} (Missing or invalid organizationId).`);
      return false;
    }

    // Lookup tenant OAuth integration
    const [integration] = await db
      .select()
      .from(google_integrations)
      .where(eq(google_integrations.organization_id, orgId))
      .limit(1);

    if (!integration || !integration.refresh_token || integration.sync_enabled !== 1) {
      // Integration not active; abort safely without noise
      return false;
    }

    const spreadsheetId = integration.spreadsheet_id;
    if (!spreadsheetId) {
      logger.info(`ℹ️ GoogleSyncDispatcher: Skipped event ${eventType} for Org ${orgId} (No spreadsheet selected).`);
      return false;
    }

    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      try {
        const refreshToken = decryptToken(integration.refresh_token);
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret || !refreshToken) {
          logger.warn(`⚠️ GoogleSyncDispatcher: Missing OAuth credentials for Org ${orgId}.`);
          return false;
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const sheetsClient = google.sheets({ version: "v4", auth: oauth2Client });

        // Ensure spreadsheet worksheets and headers exist
        await GoogleProvisioningService.provisionSpreadsheet(sheetsClient, spreadsheetId);

        // Execute event synchronization
        await this.processEvent(sheetsClient, spreadsheetId, eventType, payload, orgId, context.storeId || 1);

        const duration = Date.now() - startTime;
        logger.info(`✅ GoogleSyncDispatcher: Synced ${eventType} to Sheet ${spreadsheetId} for Org ${orgId} in ${duration}ms (Attempt ${attempt})`);

        // Update last_sync timestamp
        await db
          .update(google_integrations)
          .set({ last_sync: new Date(), updated_at: new Date() })
          .where(eq(google_integrations.id, integration.id));

        return true;
      } catch (error: any) {
        logger.warn(`⚠️ GoogleSyncDispatcher: Attempt ${attempt}/${maxRetries} failed for event ${eventType} (Org ${orgId}): ${error.message}`);
        if (attempt >= maxRetries) {
          logger.error(`❌ GoogleSyncDispatcher: Sync FAILED for event ${eventType} (Org ${orgId}) after ${maxRetries} attempts.`);
          return false;
        }
        // Exponential backoff delay: 300ms, 600ms, 1200ms
        const delay = Math.pow(2, attempt - 1) * 300;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return false;
  }

  /**
   * Process and map event to target worksheet and row strategy (Append vs In-place Upsert).
   */
  private static async processEvent(
    sheets: any,
    spreadsheetId: string,
    eventType: GoogleSyncEventType,
    payload: Record<string, any>,
    orgId: number,
    storeId: number
  ): Promise<void> {
    const formattedDate = (dateVal?: any) => {
      if (!dateVal) return formatInTimeZone(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
      try {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? String(dateVal) : formatInTimeZone(d, "Asia/Kolkata", "yyyy-MM-dd");
      } catch {
        return String(dateVal);
      }
    };

    const formattedTime = (dateVal?: any) => {
      if (!dateVal) return formatInTimeZone(new Date(), "Asia/Kolkata", "hh:mm a");
      try {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? String(dateVal) : formatInTimeZone(d, "Asia/Kolkata", "hh:mm a");
      } catch {
        return String(dateVal);
      }
    };

    switch (eventType) {
      case "SALE_CREATED": {
        const row = [
          payload.invoiceNumber || payload.invoice_number || `INV-${payload.id || Date.now()}`,
          formattedDate(payload.createdAt || payload.created_at),
          formattedTime(payload.createdAt || payload.created_at),
          payload.customerName || payload.customer_name || "Walk-in Customer",
          payload.customerPhone || payload.customer_phone || "",
          payload.paymentMethod || payload.payment_method || "CASH",
          String(payload.subtotal || payload.sub_total || 0),
          String(payload.discount || 0),
          String(payload.gstAmount || payload.gst || 0),
          String(payload.grandTotal || payload.total || 0),
          `Store #${storeId}`,
          `Org #${orgId}`,
          formattedDate(payload.createdAt || payload.created_at),
        ];
        await this.appendRow(sheets, spreadsheetId, "Sales", row);
        break;
      }

      case "PRODUCT_CREATED":
      case "PRODUCT_UPDATED":
      case "PRODUCT_ARCHIVED": {
        const sku = payload.sku || payload.barcode || `PROD-${payload.id}`;
        const row = [
          sku,
          payload.barcode || "",
          payload.name || payload.title || "",
          payload.category || "General",
          String(payload.purchasePrice || payload.purchase_price || 0),
          String(payload.sellingPrice || payload.price || 0),
          String(payload.gstRate || payload.gst || 0),
          String(payload.stock || 0),
          String(payload.minStock || payload.min_stock || 5),
          payload.status || (payload.isActive === false ? "Archived" : "Active"),
          `Store #${storeId}`,
          `Org #${orgId}`,
          formattedDate(payload.createdAt || payload.created_at),
        ];
        await this.upsertRowByKey(sheets, spreadsheetId, "Products", 0, sku, row);
        break;
      }

      case "CUSTOMER_CREATED":
      case "CUSTOMER_UPDATED": {
        const nameKey = payload.name || payload.customerName || `CUST-${payload.id}`;
        const row = [
          nameKey,
          payload.phone || payload.customerPhone || "",
          payload.email || "",
          payload.address || "",
          String(payload.totalOrders || payload.order_count || 1),
          String(payload.totalSpend || payload.total_spent || 0),
          `Store #${storeId}`,
          `Org #${orgId}`,
          formattedDate(payload.createdAt || payload.created_at),
        ];
        await this.upsertRowByKey(sheets, spreadsheetId, "Customers", 0, nameKey, row);
        break;
      }

      case "SUPPLIER_CREATED": {
        const supplierKey = payload.name || payload.supplierName || `SUPP-${payload.id}`;
        const row = [
          supplierKey,
          payload.phone || "",
          payload.email || "",
          payload.gstin || payload.gst || "",
          payload.address || "",
          `Store #${storeId}`,
          `Org #${orgId}`,
        ];
        await this.upsertRowByKey(sheets, spreadsheetId, "Suppliers", 0, supplierKey, row);
        break;
      }

      case "PURCHASE_CREATED": {
        const row = [
          payload.purchaseNumber || payload.po_number || `PO-${payload.id || Date.now()}`,
          payload.supplierName || payload.supplier || "Vendor",
          formattedDate(payload.createdAt || payload.created_at),
          payload.itemsCount || payload.items || "1 Items",
          String(payload.totalAmount || payload.amount || 0),
          `Store #${storeId}`,
          `Org #${orgId}`,
        ];
        await this.appendRow(sheets, spreadsheetId, "Purchases", row);
        break;
      }

      case "EXPENSE_CREATED": {
        const row = [
          payload.title || payload.expense || "General Expense",
          payload.category || "Operational",
          String(payload.amount || 0),
          payload.paymentMethod || "CASH",
          formattedDate(payload.date || payload.created_at),
          `Store #${storeId}`,
          `Org #${orgId}`,
        ];
        await this.appendRow(sheets, spreadsheetId, "Expenses", row);
        break;
      }

      case "INVENTORY_ADJUSTED": {
        const sku = payload.sku || `PROD-${payload.productId || payload.id}`;
        const row = [
          sku,
          payload.productName || payload.name || "Product",
          String(payload.openingStock || payload.previousStock || 0),
          String(payload.currentStock || payload.newStock || payload.stock || 0),
          String(payload.minStock || 5),
          `Store #${storeId}`,
          `Org #${orgId}`,
        ];
        await this.upsertRowByKey(sheets, spreadsheetId, "Inventory", 0, sku, row);
        break;
      }
    }
  }

  /**
   * Helper: Append a new row to the specified worksheet.
   */
  private static async appendRow(
    sheets: any,
    spreadsheetId: string,
    worksheetTitle: string,
    rowData: any[]
  ): Promise<void> {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${worksheetTitle}'!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowData],
      },
    });
  }

  /**
   * Helper: Idempotent in-place Row Upsert.
   * Searches column at keyIndex (0-indexed). If matching key exists, updates row in-place. Else appends row.
   */
  private static async upsertRowByKey(
    sheets: any,
    spreadsheetId: string,
    worksheetTitle: string,
    keyColIndex: number,
    keyVal: string,
    rowData: any[]
  ): Promise<void> {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${worksheetTitle}'!A:Z`,
    });

    const rows: string[][] = res.data.values || [];
    const targetKey = String(keyVal).trim().toLowerCase();

    let matchingRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][keyColIndex] !== undefined) {
        const cellVal = String(rows[i][keyColIndex]).trim().toLowerCase();
        if (cellVal === targetKey && cellVal !== "") {
          matchingRowIndex = i + 1; // Google Sheets is 1-indexed
          break;
        }
      }
    }

    if (matchingRowIndex !== -1) {
      // Update existing row in-place
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${worksheetTitle}'!A${matchingRowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });
      logger.info(`📝 GoogleSyncDispatcher: Updated row ${matchingRowIndex} in worksheet "${worksheetTitle}" for key: ${keyVal}`);
    } else {
      // Append new row if key does not exist
      await this.appendRow(sheets, spreadsheetId, worksheetTitle, rowData);
      logger.info(`➕ GoogleSyncDispatcher: Appended new row in worksheet "${worksheetTitle}" for key: ${keyVal}`);
    }
  }
}
