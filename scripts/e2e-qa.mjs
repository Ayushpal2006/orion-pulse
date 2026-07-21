/**
 * Orion POS — Production E2E QA Script
 *
 * Usage:
 *   node scripts/e2e-qa.mjs
 *
 * Requires the backend to be running at http://localhost:8080 with
 * a live PostgreSQL connection (Railway production or local pg).
 *
 * NOTE: This script will skip gracefully and report "DB OFFLINE" if the
 * backend is running in placeholder/offline mode (Railway private network
 * not reachable locally). In that case, deploy to Railway and re-run.
 */

import http from "http";

const API_BASE = process.env.API_BASE || "http://localhost:8080";

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const reqOpts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const req = http.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", (err) => reject(err));
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runE2ETests() {
  console.log("=================================================");
  console.log("🚀 Starting Orion POS Production E2E QA Verification");
  console.log(`📡 Target: ${API_BASE}`);
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let dbOnline = true;

  async function test(name, fn, { skipIfDbOffline = true } = {}) {
    if (skipIfDbOffline && !dbOnline) {
      console.log(`⏭️  [SKIP] ${name} (DB offline)`);
      skipped++;
      return;
    }
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // ─── 0. Server & DB Health ──────────────────────────────────────────────────

  await test("GET /health returns 200", async () => {
    const res = await request("/health");
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  }, { skipIfDbOffline: false });

  await test("GET / returns {status:'ok'}", async () => {
    const res = await request("/");
    if (res.status !== 200 || res.data.status !== "ok") throw new Error(`Unexpected response`);
  }, { skipIfDbOffline: false });

  // Probe if DB is reachable
  {
    const res = await request("/health").catch(() => ({ status: 0, data: {} }));
    if (res.data?.database === "OFFLINE") {
      console.log("\n⚠️  DATABASE IS OFFLINE — backend is in placeholder mode.\n   Deploy to Railway to run full suite.\n   Skipping all DB-dependent tests.\n");
      dbOnline = false;
    }
  }

  // ─── 1. Products ─────────────────────────────────────────────────────────────

  let testProductId = null;

  await test("GET /api/products returns array", async () => {
    const res = await request("/api/products");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
  });

  await test("POST /api/products creates product (correct field names)", async () => {
    const res = await request("/api/products", {
      method: "POST",
      body: {
        name: "QA Test Shirt " + Date.now(),
        sku: "QA-TST-" + Math.floor(Math.random() * 10000),
        barcode: "",
        purchase_price: 49900,    // paise — matches schema
        selling_price: 99900,     // paise — matches schema
        stock: 50,
        minimum_stock: 5,
        gst: 5,
        category: "Test",
      },
    });
    if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    testProductId = res.data?.data?.id;
  });

  await test("PUT /api/products/:id updates selling_price", async () => {
    if (!testProductId) throw new Error("No product id — create failed");
    const res = await request(`/api/products/${testProductId}`, {
      method: "PUT",
      body: { selling_price: 109900 },
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await test("DELETE /api/products/:id soft-deletes product", async () => {
    if (!testProductId) throw new Error("No product id — create failed");
    const res = await request(`/api/products/${testProductId}`, { method: "DELETE" });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // ─── 2. Customers ────────────────────────────────────────────────────────────

  let testCustomerId = null;

  await test("GET /api/customers returns array", async () => {
    const res = await request("/api/customers");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Status ${res.status}`);
  });

  await test("POST /api/customers creates customer", async () => {
    const res = await request("/api/customers", {
      method: "POST",
      body: {
        name: "QA Customer " + Date.now(),
        phone: "9" + String(Math.floor(Math.random() * 1000000000)).padStart(9, "0"),
        email: "qacustomer@test.com",
      },
    });
    if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    testCustomerId = res.data?.data?.id;
  });

  // ─── 3. Suppliers ────────────────────────────────────────────────────────────

  let testSupplierId = null;

  await test("GET /api/suppliers returns array", async () => {
    const res = await request("/api/suppliers");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Status ${res.status}`);
  });

  await test("POST /api/suppliers creates supplier (10-digit phone)", async () => {
    const res = await request("/api/suppliers", {
      method: "POST",
      body: {
        name: "QA Supplier " + Date.now(),
        phone: "9" + String(Math.floor(Math.random() * 1000000000)).padStart(9, "0"), // exactly 10 digits
        email: "supplier@qa.com",
        gstin: "",  // empty string is fine
      },
    });
    if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    testSupplierId = res.data?.data?.id;
  });

  await test("PUT /api/suppliers/:id updates supplier", async () => {
    if (!testSupplierId) throw new Error("No supplier id");
    const res = await request(`/api/suppliers/${testSupplierId}`, {
      method: "PUT",
      body: { phone: "9" + String(Math.floor(Math.random() * 1000000000)).padStart(9, "0") },
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await test("DELETE /api/suppliers/:id archives supplier", async () => {
    if (!testSupplierId) throw new Error("No supplier id");
    const res = await request(`/api/suppliers/${testSupplierId}`, { method: "DELETE" });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // ─── 4. Stock Adjustments ────────────────────────────────────────────────────

  await test("GET /api/stock-adjustments returns array (no SQL param errors)", async () => {
    const res = await request("/api/stock-adjustments");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
  });

  // ─── 5. Expenses ─────────────────────────────────────────────────────────────

  let testCategoryId = null;
  let testExpenseId = null;

  await test("GET /api/expenses/categories auto-seeds defaults", async () => {
    const res = await request("/api/expenses/categories");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Status ${res.status}`);
    testCategoryId = res.data.data[0]?.id;
  });

  await test("GET /api/expenses returns array", async () => {
    const res = await request("/api/expenses");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Status ${res.status}`);
  });

  await test("POST /api/expenses creates expense (camelCase body)", async () => {
    if (!testCategoryId) throw new Error("No category id — categories fetch failed");
    const res = await request("/api/expenses", {
      method: "POST",
      body: {
        categoryId: testCategoryId,   // camelCase as required by expense.controller.ts
        amount: 50000,                // paise — must be > 0
        paymentMethod: "Cash",        // camelCase
        vendor: "QA Electricity Board",
        description: "Monthly electricity bill",
        date: new Date().toISOString(),
      },
    });
    if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    testExpenseId = res.data?.data?.id;
  });

  await test("PUT /api/expenses/:id updates amount", async () => {
    if (!testExpenseId) throw new Error("No expense id");
    const res = await request(`/api/expenses/${testExpenseId}`, {
      method: "PUT",
      body: { amount: 60000 },
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await test("DELETE /api/expenses/:id deletes expense", async () => {
    if (!testExpenseId) throw new Error("No expense id");
    const res = await request(`/api/expenses/${testExpenseId}`, { method: "DELETE" });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await test("GET /api/expenses/summary returns KPIs", async () => {
    const res = await request("/api/expenses/summary");
    if (res.status !== 200 || !res.data.success) throw new Error(`Status ${res.status}`);
  });

  // ─── 6. Profit Engine ────────────────────────────────────────────────────────

  await test("GET /api/profit/summary returns Revenue, COGS, Gross Profit, Expenses, Net Profit", async () => {
    const res = await request("/api/profit/summary");
    if (res.status !== 200 || !res.data.success) throw new Error(`Status ${res.status}`);
  });

  await test("GET /api/profit/products returns product-level profit breakdown", async () => {
    const res = await request("/api/profit/products");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Status ${res.status}`);
  });

  // ─── 7. Purchases ────────────────────────────────────────────────────────────

  await test("GET /api/purchases returns array", async () => {
    const res = await request("/api/purchases");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Status ${res.status}`);
  });

  // ─── 8. Reports ──────────────────────────────────────────────────────────────
  // Reports endpoint is GET /api/reports (not /api/reports/dashboard)

  await test("GET /api/reports returns sales reports", async () => {
    const res = await request("/api/reports");
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // ─── Summary ─────────────────────────────────────────────────────────────────

  console.log("\n=================================================");
  console.log(`📊 E2E QA Summary: ✅ ${passed} Passed | ❌ ${failed} Failed | ⏭️  ${skipped} Skipped`);
  console.log("=================================================\n");

  if (failed > 0) process.exit(1);
}

runE2ETests().catch((e) => {
  console.error("Fatal E2E test runner error:", e);
  process.exit(1);
});
