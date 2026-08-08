import { GoogleSyncDispatcher, GoogleSyncEventType } from "../services/google-sync-dispatcher.service";

async function runSyncEngineTests() {
  console.log("==================================================");
  console.log("🧪 GOOGLE SYNC ENGINE (PHASE 4) TEST SUITE");
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
    // Mock Sheets State Store
    // --------------------------------------------------
    const mockSheetsState: Record<string, string[][]> = {
      Sales: [
        ["Invoice Number", "Date", "Time", "Customer Name", "Customer Phone", "Payment Method", "Subtotal", "Discount", "GST", "Grand Total", "Store", "Organization", "Created At"],
      ],
      Products: [
        ["SKU", "Barcode", "Product Name", "Category", "Purchase Price", "Selling Price", "GST", "Stock", "Minimum Stock", "Status", "Store", "Organization", "Created At"],
      ],
      Customers: [
        ["Customer Name", "Phone", "Email", "Address", "Total Orders", "Total Spend", "Store", "Organization", "Created At"],
      ],
      Suppliers: [
        ["Supplier Name", "Phone", "Email", "GST", "Address", "Store", "Organization"],
      ],
      Purchases: [
        ["Purchase Number", "Supplier", "Date", "Items", "Amount", "Store", "Organization"],
      ],
      Expenses: [
        ["Expense", "Category", "Amount", "Payment Method", "Date", "Store", "Organization"],
      ],
      Inventory: [
        ["SKU", "Product Name", "Opening Stock", "Current Stock", "Minimum Stock", "Store", "Organization"],
      ],
    };

    const mockSheetsClient = {
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: Object.keys(mockSheetsState).map((title) => ({ properties: { title } })),
          },
        }),
        batchUpdate: async () => ({ data: {} }),
        values: {
          get: async ({ range }: { range: string }) => {
            const sheetName = range.replace(/'/g, "").split("!")[0];
            return {
              data: {
                values: mockSheetsState[sheetName] || [],
              },
            };
          },
          update: async ({ range, requestBody }: { range: string; requestBody: any }) => {
            const parts = range.replace(/'/g, "").split("!");
            const sheetName = parts[0];
            const cellRange = parts[1]; // e.g. "A2"
            const rowIndex = parseInt(cellRange.substring(1), 10) - 1;

            if (!mockSheetsState[sheetName]) mockSheetsState[sheetName] = [];
            mockSheetsState[sheetName][rowIndex] = requestBody.values[0];
            return { data: {} };
          },
          append: async ({ range, requestBody }: { range: string; requestBody: any }) => {
            const sheetName = range.replace(/'/g, "").split("!")[0];
            if (!mockSheetsState[sheetName]) mockSheetsState[sheetName] = [];
            mockSheetsState[sheetName].push(requestBody.values[0]);
            return { data: {} };
          },
        },
      },
    };

    // --------------------------------------------------
    // TEST 1: Non-Blocking Dispatch Guarantee
    // --------------------------------------------------
    console.log("--- TEST GROUP 1: Non-Blocking Dispatch & Resilience ---");

    let dispatchCompleted = false;
    const startTime = Date.now();

    // Dispatch event synchronously from test caller
    GoogleSyncDispatcher.dispatchSyncEvent("SALE_CREATED", {
      invoiceNumber: "INV-TEST-001",
      customerName: "Alice Smith",
      grandTotal: 1500,
    }, { organizationId: 999 });

    const returnTime = Date.now() - startTime;
    assert(returnTime < 100, "dispatchSyncEvent returns immediately (<100ms) without blocking execution");

    console.log("✅ Non-Blocking Dispatch tests passed.\n");

    // --------------------------------------------------
    // TEST 2: Product Upsert & In-Place Row Updates
    // --------------------------------------------------
    console.log("--- TEST GROUP 2: Product In-Place Row Upsert ---");

    // Process PRODUCT_CREATED
    await (GoogleSyncDispatcher as any).processEvent(mockSheetsClient, "sheet_1", "PRODUCT_CREATED", {
      id: 101,
      sku: "SKU-BEV-001",
      name: "Cold Coffee",
      category: "Beverages",
      sellingPrice: 120,
      stock: 50,
    }, 1, 1);

    assert(mockSheetsState["Products"].length === 2, "Product row appended on creation");
    assert(mockSheetsState["Products"][1][0] === "SKU-BEV-001", "Product SKU matches");
    assert(mockSheetsState["Products"][1][5] === "120", "Selling price is 120");

    // Process PRODUCT_UPDATED (Edit price to 150 & stock to 45)
    await (GoogleSyncDispatcher as any).processEvent(mockSheetsClient, "sheet_1", "PRODUCT_UPDATED", {
      id: 101,
      sku: "SKU-BEV-001",
      name: "Cold Coffee",
      category: "Beverages",
      sellingPrice: 150,
      stock: 45,
    }, 1, 1);

    assert(mockSheetsState["Products"].length === 2, "Product count remains 2 (In-place update, NO duplicate row)");
    assert(mockSheetsState["Products"][1][5] === "150", "Selling price updated in-place to 150");
    assert(mockSheetsState["Products"][1][7] === "45", "Stock updated in-place to 45");

    console.log("✅ Product In-Place Row Upsert tests passed.\n");

    // --------------------------------------------------
    // TEST 3: Inventory Stock Adjustment In-Place Update
    // --------------------------------------------------
    console.log("--- TEST GROUP 3: Inventory In-Place Update ---");

    await (GoogleSyncDispatcher as any).processEvent(mockSheetsClient, "sheet_1", "INVENTORY_ADJUSTED", {
      productId: 101,
      sku: "SKU-BEV-001",
      productName: "Cold Coffee",
      openingStock: 45,
      currentStock: 40,
    }, 1, 1);

    assert(mockSheetsState["Inventory"].length === 2, "Inventory row created for Cold Coffee");
    assert(mockSheetsState["Inventory"][1][3] === "40", "Current stock set to 40");

    // Adjust stock again to 35
    await (GoogleSyncDispatcher as any).processEvent(mockSheetsClient, "sheet_1", "INVENTORY_ADJUSTED", {
      productId: 101,
      sku: "SKU-BEV-001",
      productName: "Cold Coffee",
      openingStock: 40,
      currentStock: 35,
    }, 1, 1);

    assert(mockSheetsState["Inventory"].length === 2, "Inventory row updated IN-PLACE (No duplicates)");
    assert(mockSheetsState["Inventory"][1][3] === "35", "Current stock updated in-place to 35");

    console.log("✅ Inventory In-Place Update tests passed.\n");

    // --------------------------------------------------
    // TEST 4: Customer Upsert & Data Integrity
    // --------------------------------------------------
    console.log("--- TEST GROUP 4: Customer Upsert ---");

    await (GoogleSyncDispatcher as any).processEvent(mockSheetsClient, "sheet_1", "CUSTOMER_CREATED", {
      id: 50,
      name: "Rahul Sharma",
      phone: "9876543210",
      totalOrders: 1,
      totalSpend: 500,
    }, 1, 1);

    assert(mockSheetsState["Customers"].length === 2, "Customer row appended");

    // Update customer spend
    await (GoogleSyncDispatcher as any).processEvent(mockSheetsClient, "sheet_1", "CUSTOMER_UPDATED", {
      id: 50,
      name: "Rahul Sharma",
      phone: "9876543210",
      totalOrders: 2,
      totalSpend: 1200,
    }, 1, 1);

    assert(mockSheetsState["Customers"].length === 2, "Customer updated IN-PLACE without duplicate row");
    assert(mockSheetsState["Customers"][1][5] === "1200", "Total spend updated in-place to 1200");

    console.log("✅ Customer Upsert tests passed.\n");

    // --------------------------------------------------
    // TEST 5: Manual Sync Idempotency
    // --------------------------------------------------
    console.log("--- TEST GROUP 5: Manual Sync Idempotency ---");

    const initialProductCount = mockSheetsState["Products"].length;

    // Simulate double execution of product sync
    await (GoogleSyncDispatcher as any).processEvent(mockSheetsClient, "sheet_1", "PRODUCT_UPDATED", {
      id: 101,
      sku: "SKU-BEV-001",
      name: "Cold Coffee",
      category: "Beverages",
      sellingPrice: 150,
      stock: 35,
    }, 1, 1);

    assert(mockSheetsState["Products"].length === initialProductCount, "Re-running sync on existing records creates ZERO duplicates");

    console.log("✅ Manual Sync Idempotency tests passed.\n");

    console.log("==================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 4 TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");
  } catch (error: any) {
    console.error("\n❌ Phase 4 Test Suite Failed with Exception:", error.message);
    process.exit(1);
  }
}

runSyncEngineTests().then(() => process.exit(0));
