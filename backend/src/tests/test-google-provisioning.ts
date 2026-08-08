import { GoogleProvisioningService, REQUIRED_WORKSHEETS } from "../services/google-provisioning.service";

async function runProvisioningTests() {
  console.log("==================================================");
  console.log("🧪 GOOGLE SPREADSHEET PROVISIONING & REPAIR TEST SUITE");
  console.log("==================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // --------------------------------------------------
    // Mock Google Sheets API Client
    // --------------------------------------------------
    const mockSheetsState: {
      sheets: Array<{ title: string }>;
      values: Record<string, string[][]>;
      batchUpdateCount: number;
    } = {
      sheets: [{ title: "Sheet1" }], // Default initial sheet in new Google Spreadsheet
      values: {},
      batchUpdateCount: 0,
    };

    const mockSheetsClient = {
      spreadsheets: {
        get: async ({ spreadsheetId }: { spreadsheetId: string }) => {
          if (spreadsheetId === "invalid_id") {
            const err: any = new Error("Spreadsheet not found. Reconnect Google.");
            err.status = 404;
            throw err;
          }
          return {
            data: {
              sheets: mockSheetsState.sheets.map((s) => ({ properties: { title: s.title } })),
            },
          };
        },
        batchUpdate: async ({ spreadsheetId, requestBody }: { spreadsheetId: string; requestBody: any }) => {
          mockSheetsState.batchUpdateCount++;
          const reqs = requestBody.requests || [];
          for (const r of reqs) {
            if (r.addSheet && r.addSheet.properties?.title) {
              mockSheetsState.sheets.push({ title: r.addSheet.properties.title });
            }
          }
          return { data: {} };
        },
        values: {
          get: async ({ spreadsheetId, range }: { spreadsheetId: string; range: string }) => {
            const sheetName = range.replace(/'/g, "").split("!")[0];
            return {
              data: {
                values: mockSheetsState.values[sheetName] || [],
              },
            };
          },
          update: async ({ spreadsheetId, range, requestBody }: { spreadsheetId: string; range: string; requestBody: any }) => {
            const sheetName = range.replace(/'/g, "").split("!")[0];
            mockSheetsState.values[sheetName] = requestBody.values;
            return { data: {} };
          },
        },
      },
    };

    // --------------------------------------------------
    // TEST 1: Fresh Empty Spreadsheet Provisioning
    // --------------------------------------------------
    console.log("--- TEST GROUP 1: Fresh Empty Spreadsheet Provisioning ---");
    const result1 = await GoogleProvisioningService.provisionSpreadsheet(mockSheetsClient, "fresh_sheet_123");

    assert(result1.success === true, "Provisioning succeeded on fresh spreadsheet");
    assert(result1.createdWorksheets.length === 8, "All 8 required worksheets created");
    assert(result1.headersInserted.length === 8, "All 8 required worksheet headers inserted");

    // Verify all 8 worksheets exist in mock state
    for (const reqSheet of REQUIRED_WORKSHEETS) {
      const exists = mockSheetsState.sheets.some((s) => s.title === reqSheet.title);
      assert(exists, `Worksheet "${reqSheet.title}" exists in spreadsheet`);

      const insertedHeaders = mockSheetsState.values[reqSheet.title]?.[0] || [];
      assert(insertedHeaders.length === reqSheet.headers.length, `Worksheet "${reqSheet.title}" contains exact header count (${reqSheet.headers.length})`);
      assert(insertedHeaders[0] === reqSheet.headers[0], `Worksheet "${reqSheet.title}" header starts with "${reqSheet.headers[0]}"`);
    }

    console.log("✅ Fresh empty spreadsheet provisioning tests passed.\n");

    // --------------------------------------------------
    // TEST 2: Idempotency (Existing Headers & Data Left Untouched)
    // --------------------------------------------------
    console.log("--- TEST GROUP 2: Idempotency & Data Safety ---");
    // Populate dummy row data in Sales sheet
    mockSheetsState.values["Sales"].push(["INV-1001", "2026-08-08", "10:00 AM", "John Doe", "9876543210", "CASH", "1000", "0", "180", "1180", "Store 1", "Org 1", "2026-08-08"]);

    const initialSalesRowCount = mockSheetsState.values["Sales"].length;

    // Run provisioning again on existing spreadsheet
    const result2 = await GoogleProvisioningService.provisionSpreadsheet(mockSheetsClient, "fresh_sheet_123");

    assert(result2.success === true, "Idempotent provisioning succeeded");
    assert(result2.createdWorksheets.length === 0, "No duplicate worksheets created");
    assert(result2.headersInserted.length === 0, "No duplicate headers inserted");
    assert(mockSheetsState.values["Sales"].length === initialSalesRowCount, "Existing Sales data rows left untouched");

    console.log("✅ Idempotency & Data Safety tests passed.\n");

    // --------------------------------------------------
    // TEST 3: Self-Healing Repair (Deleted Worksheet Recreated)
    // --------------------------------------------------
    console.log("--- TEST GROUP 3: Automatic Self-Healing Repair ---");

    // Simulate manual deletion of "Inventory" worksheet by user
    mockSheetsState.sheets = mockSheetsState.sheets.filter((s) => s.title !== "Inventory");
    delete mockSheetsState.values["Inventory"];

    assert(!mockSheetsState.sheets.some((s) => s.title === "Inventory"), "Simulated deletion of Inventory worksheet");

    // Run provisioning repair
    const result3 = await GoogleProvisioningService.provisionSpreadsheet(mockSheetsClient, "fresh_sheet_123");

    assert(result3.success === true, "Self-healing repair succeeded");
    assert(result3.createdWorksheets.includes("Inventory"), "Missing 'Inventory' worksheet automatically recreated");
    assert(result3.headersInserted.includes("Inventory"), "Missing 'Inventory' headers automatically re-inserted");
    assert(result3.createdWorksheets.length === 1, "Only missing worksheet was recreated; others untouched");

    console.log("✅ Self-Healing Repair tests passed.\n");

    // --------------------------------------------------
    // TEST 4: Error Handling & Permission Safeguards
    // --------------------------------------------------
    console.log("--- TEST GROUP 4: Error Handling & Permission Safeguards ---");

    const resultErr = await GoogleProvisioningService.provisionSpreadsheet(mockSheetsClient, "invalid_id");
    assert(resultErr.success === false, "Handles invalid/inaccessible spreadsheet gracefully");
    assert(Boolean(resultErr.error?.includes("Spreadsheet not found")), "Returns clear user-facing error message");

    console.log("✅ Error Handling tests passed.\n");

    console.log("==================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 3 TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");
  } catch (error: any) {
    console.error("\n❌ Phase 3 Test Suite Failed with Exception:", error.message);
    process.exit(1);
  }
}

runProvisioningTests().then(() => process.exit(0));
