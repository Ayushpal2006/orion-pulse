const http = require("http");

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime();
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        const diff = process.hrtime(start);
        const timeMs = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, timeMs, length: data.length, success: json.success });
        } catch (e) {
          resolve({ status: res.statusCode, timeMs, length: data.length, success: false });
        }
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

async function runPerfSuite() {
  console.log("⚡ Starting Programmatic Performance Suite...");
  
  const endpoints = [
    { name: "Root Health Check", url: "http://localhost:8080/" },
    { name: "Dashboard Data", url: "http://localhost:8080/dashboard" },
    { name: "Products List", url: "http://localhost:8080/products" },
    { name: "Product Search (Model 050)", url: "http://localhost:8080/products/search?q=Model%20050" },
    { name: "Customers List", url: "http://localhost:8080/customers" },
    { name: "Customer Search (Sharma)", url: "http://localhost:8080/customers/search?q=Sharma" },
    { name: "Sales History", url: "http://localhost:8080/sales" },
    { name: "Sync Queue Status", url: "http://localhost:8080/sync/status" },
    { name: "Reports Data (Today)", url: "http://localhost:8080/reports/pdf?filter=today" }, // trigger reports logic
  ];

  console.log("\n--- API LATENCY METRICS ---");
  for (const ep of endpoints) {
    try {
      const result = await fetchUrl(ep.url);
      console.log(`- ${ep.name.padEnd(28)}: Status ${result.status} | Latency: ${result.timeMs}ms | Size: ${result.length} bytes`);
    } catch (e) {
      console.log(`- ${ep.name.padEnd(28)}: FAILED (${e.message})`);
    }
  }

  // Database checks directly via better-sqlite3
  console.log("\n--- SQLITE STATS & INTEGRITY ---");
  const Database = require("better-sqlite3");
  const path = require("path");
  const db = new Database(path.join(__dirname, "../../database/orion.db"));
  
  const startDb = process.hrtime();
  const integrity = db.pragma("integrity_check");
  const diffDb = process.hrtime(startDb);
  const dbCheckTime = (diffDb[0] * 1000 + diffDb[1] / 1000000).toFixed(2);
  console.log(`- Integrity Check Status: ${integrity}`);
  console.log(`- Integrity Check Time  : ${dbCheckTime}ms`);

  const prodCount = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
  const custCount = db.prepare("SELECT COUNT(*) as c FROM customers").get().c;
  const salesCount = db.prepare("SELECT COUNT(*) as c FROM sales").get().c;
  const itemsCount = db.prepare("SELECT COUNT(*) as c FROM sale_items").get().c;

  console.log(`- Total Catalog Products: ${prodCount}`);
  console.log(`- Total Registered Custs: ${custCount}`);
  console.log(`- Total Sales Ledger Rows: ${salesCount}`);
  console.log(`- Total Invoice Item Rows: ${itemsCount}`);

  // Query performance check: Complex reports query time
  const startReportQ = process.hrtime();
  const reportSummary = db.prepare(`
    SELECT 
      SUM(grand_total) as revenue,
      SUM(gst) as totalGst,
      SUM(discount) as totalDiscount
    FROM sales
    WHERE created_at >= date('now', '-30 days')
  `).get();
  const diffReportQ = process.hrtime(startReportQ);
  const reportQTime = (diffReportQ[0] * 1000 + diffReportQ[1] / 1000000).toFixed(2);
  console.log(`- 30-Day Sum Query Time  : ${reportQTime}ms`);
  console.log(`- 30-Day Revenue Sum     : ₹${(reportSummary.revenue / 100).toFixed(2)}`);

  db.close();
  console.log("\n✅ Latency suite finished!");
}

runPerfSuite().catch(console.error);
