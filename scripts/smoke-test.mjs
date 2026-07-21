import http from "http";

const API_BASE = "http://localhost:8080";

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const reqOpts = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const req = http.request(url, reqOpts, (res) => {
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

async function runSmokeTests() {
  console.log("🚀 Starting Orion POS Comprehensive E2E API Smoke Tests...\n");
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Health & Server Status
  await test("GET /health responds with 200", async () => {
    const res = await request("/health");
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await test("GET / responds with 200 OK status", async () => {
    const res = await request("/");
    if (res.status !== 200 || res.data.status !== "ok") throw new Error(`Unexpected body`);
  });

  // 2. Products API
  await test("GET /api/products returns products list", async () => {
    const res = await request("/api/products");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Invalid response`);
  });

  // 3. Stock Adjustments API (Fix Verification)
  await test("GET /api/stock-adjustments executes cleanly without SQL errors", async () => {
    const res = await request("/api/stock-adjustments");
    if (res.status !== 200 || !Array.isArray(res.data.data)) {
      throw new Error(`Failed with status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // 4. Customers & Suppliers API
  await test("GET /api/customers returns customer list", async () => {
    const res = await request("/api/customers");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Failed status ${res.status}`);
  });

  await test("GET /api/suppliers returns supplier list", async () => {
    const res = await request("/api/suppliers");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Failed status ${res.status}`);
  });

  // 5. Expenses Module API
  await test("GET /api/expenses/categories returns expense categories", async () => {
    const res = await request("/api/expenses/categories");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Failed status ${res.status}`);
  });

  await test("GET /api/expenses returns expenses list", async () => {
    const res = await request("/api/expenses");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Failed status ${res.status}`);
  });

  await test("GET /api/expenses/summary returns expense summary KPIs", async () => {
    const res = await request("/api/expenses/summary");
    if (res.status !== 200 || !res.data.success) throw new Error(`Failed status ${res.status}`);
  });

  // 6. Profit & Margin Engine API
  await test("GET /api/profit/summary returns profit, revenue, cogs, expenses & net profit", async () => {
    const res = await request("/api/profit/summary");
    if (res.status !== 200 || !res.data.success) throw new Error(`Failed status ${res.status}`);
  });

  await test("GET /api/profit/products returns top product P&L breakdown", async () => {
    const res = await request("/api/profit/products");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Failed status ${res.status}`);
  });

  // 7. Purchases API
  await test("GET /api/purchases returns purchase orders history", async () => {
    const res = await request("/api/purchases");
    if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error(`Failed status ${res.status}`);
  });

  // 8. Reports API
  await test("GET /api/reports/dashboard returns report metrics", async () => {
    const res = await request("/api/reports/dashboard");
    if (res.status !== 200 || !res.data.success) throw new Error(`Failed status ${res.status}`);
  });

  console.log(`\n========================================`);
  console.log(`📊 Smoke Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runSmokeTests().catch((e) => {
  console.error("Fatal test error:", e);
  process.exit(1);
});
