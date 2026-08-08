import { logger } from "../logger/logger";

export interface WorksheetDefinition {
  title: string;
  headers: string[];
}

export const REQUIRED_WORKSHEETS: WorksheetDefinition[] = [
  {
    title: "Sales",
    headers: [
      "Invoice Number",
      "Date",
      "Time",
      "Customer Name",
      "Customer Phone",
      "Payment Method",
      "Subtotal",
      "Discount",
      "GST",
      "Grand Total",
      "Store",
      "Organization",
      "Created At",
    ],
  },
  {
    title: "Products",
    headers: [
      "SKU",
      "Barcode",
      "Product Name",
      "Category",
      "Purchase Price",
      "Selling Price",
      "GST",
      "Stock",
      "Minimum Stock",
      "Status",
      "Store",
      "Organization",
      "Created At",
    ],
  },
  {
    title: "Customers",
    headers: [
      "Customer Name",
      "Phone",
      "Email",
      "Address",
      "Total Orders",
      "Total Spend",
      "Store",
      "Organization",
      "Created At",
    ],
  },
  {
    title: "Purchases",
    headers: [
      "Purchase Number",
      "Supplier",
      "Date",
      "Items",
      "Amount",
      "Store",
      "Organization",
    ],
  },
  {
    title: "Suppliers",
    headers: [
      "Supplier Name",
      "Phone",
      "Email",
      "GST",
      "Address",
      "Store",
      "Organization",
    ],
  },
  {
    title: "Inventory",
    headers: [
      "SKU",
      "Product Name",
      "Opening Stock",
      "Current Stock",
      "Minimum Stock",
      "Store",
      "Organization",
    ],
  },
  {
    title: "Expenses",
    headers: [
      "Expense",
      "Category",
      "Amount",
      "Payment Method",
      "Date",
      "Store",
      "Organization",
    ],
  },
  {
    title: "Reports",
    headers: [
      "Report Type",
      "Generated At",
      "Store",
      "Organization",
    ],
  },
];

export class GoogleProvisioningService {
  /**
   * Provision a Google Spreadsheet by ensuring all required worksheets and headers exist.
   * Safe & Idempotent: Does NOT delete existing sheets or overwrite existing data.
   */
  static async provisionSpreadsheet(
    sheetsClient: any,
    spreadsheetId: string
  ): Promise<{
    success: boolean;
    createdWorksheets: string[];
    headersInserted: string[];
    error?: string;
  }> {
    if (!sheetsClient || !spreadsheetId) {
      return { success: false, createdWorksheets: [], headersInserted: [], error: "Missing sheetsClient or spreadsheetId" };
    }

    try {
      logger.info(`🛠️ Starting automatic spreadsheet provisioning for Google Sheet ID: ${spreadsheetId}...`);

      // Step 1: Fetch existing worksheet metadata
      const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
      const existingSheets: string[] = (meta.data.sheets || []).map(
        (s: any) => s.properties?.title || ""
      );

      const createdWorksheets: string[] = [];
      const headersInserted: string[] = [];

      // Step 2: Create missing worksheets via batchUpdate addSheet
      const addSheetRequests: any[] = [];
      for (const reqSheet of REQUIRED_WORKSHEETS) {
        if (!existingSheets.includes(reqSheet.title)) {
          addSheetRequests.push({
            addSheet: {
              properties: {
                title: reqSheet.title,
              },
            },
          });
          createdWorksheets.push(reqSheet.title);
        }
      }

      if (addSheetRequests.length > 0) {
        logger.info(`📄 Creating ${addSheetRequests.length} missing worksheet(s): ${createdWorksheets.join(", ")}`);
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: addSheetRequests,
          },
        });
      }

      // Step 3: Check and insert headers if first row is empty
      for (const reqSheet of REQUIRED_WORKSHEETS) {
        try {
          const res = await sheetsClient.spreadsheets.values.get({
            spreadsheetId,
            range: `'${reqSheet.title}'!A1:Z1`,
          });

          const rows = res.data.values || [];
          const hasHeaders = rows.length > 0 && rows[0].length > 0;

          if (!hasHeaders) {
            logger.info(`🏷️ Inserting column headers for worksheet "${reqSheet.title}"`);
            await sheetsClient.spreadsheets.values.update({
              spreadsheetId,
              range: `'${reqSheet.title}'!A1`,
              valueInputOption: "USER_ENTERED",
              requestBody: {
                values: [reqSheet.headers],
              },
            });
            headersInserted.push(reqSheet.title);
          }
        } catch (headerErr: any) {
          logger.warn(`Header check/insert notice for sheet "${reqSheet.title}": ${headerErr.message}`);
        }
      }

      logger.info(`✅ Spreadsheet provisioning complete for Sheet ID: ${spreadsheetId}. (Created: ${createdWorksheets.length}, Headers Inserted: ${headersInserted.length})`);

      return {
        success: true,
        createdWorksheets,
        headersInserted,
      };
    } catch (error: any) {
      let errorMsg = error.message || String(error);
      if (error.status === 403 || (error.message && error.message.includes("permission"))) {
        errorMsg = "Permission Denied. Reconnect required.";
      } else if (error.status === 404 || (error.message && error.message.includes("not found"))) {
        errorMsg = "Spreadsheet not found. Reconnect Google.";
      }

      logger.error(`❌ Automatic spreadsheet provisioning failed for Sheet ID ${spreadsheetId}: ${errorMsg}`);
      return {
        success: false,
        createdWorksheets: [],
        headersInserted: [],
        error: errorMsg,
      };
    }
  }

  /**
   * Idempotently verify and repair structure for a specific worksheet.
   */
  static async ensureWorksheetAndHeaders(
    sheetsClient: any,
    spreadsheetId: string,
    worksheetTitle: string
  ): Promise<boolean> {
    try {
      const def = REQUIRED_WORKSHEETS.find((w) => w.title === worksheetTitle);
      if (!def) return false;

      const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
      const existingSheets: string[] = (meta.data.sheets || []).map((s: any) => s.properties?.title || "");

      if (!existingSheets.includes(worksheetTitle)) {
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: worksheetTitle } } }],
          },
        });
      }

      const res = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: `'${worksheetTitle}'!A1:Z1`,
      });

      const rows = res.data.values || [];
      if (rows.length === 0 || rows[0].length === 0) {
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range: `'${worksheetTitle}'!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [def.headers] },
        });
      }

      return true;
    } catch (err: any) {
      logger.warn(`Failed to repair worksheet "${worksheetTitle}": ${err.message}`);
      return false;
    }
  }
}
