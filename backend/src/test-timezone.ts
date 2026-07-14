import dbProxy from "./database";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { PostgresReportsRepository } from "./repositories/postgres/reports.repository";
import { PostgresSaleRepository } from "./repositories/postgres/sale.repository";
import { PostgresDashboardRepository } from "./repositories/postgres/dashboard.repository";
import { initDb } from "./database/init";

const TZ = "Asia/Kolkata";

async function main() {
  console.log("🕒 Starting Automated Timezone Filtering Tests...");

  // 0. Initialize and migrate database
  await initDb();

  // 1. Get today's local date in Kolkata
  const now = new Date();
  const dateStr = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  console.log(`Local Date under test: ${dateStr}`);

  // 2. Compute UTC dates for the 3 test times
  const timeA = fromZonedTime(`${dateStr} 00:10:00`, TZ);
  const timeB = fromZonedTime(`${dateStr} 11:30:00`, TZ);
  const timeC = fromZonedTime(`${dateStr} 23:55:00`, TZ);

  console.log(`Sale A (00:10 IST) -> UTC: ${timeA.toISOString()}`);
  console.log(`Sale B (11:30 IST) -> UTC: ${timeB.toISOString()}`);
  console.log(`Sale C (23:55 IST) -> UTC: ${timeC.toISOString()}`);

  // 3. Clean up existing sales
  console.log("🧹 Clearing transactional tables...");
  await dbProxy.execute("DELETE FROM sale_items;");
  await dbProxy.execute("DELETE FROM returns;");
  await dbProxy.execute("DELETE FROM sales;");
  await dbProxy.execute("DELETE FROM products;");
  await dbProxy.execute("DELETE FROM customers;");

  // Insert a test product and customer so checkout constraints pass
  await dbProxy.execute(
    "INSERT INTO products (id, store_id, name, sku, purchase_price, selling_price, stock, minimum_stock) VALUES (1, 1, 'Timezone Test Product', 'TZ-TEST', 1000, 1500, 100, 2)"
  );
  await dbProxy.execute(
    "INSERT INTO customers (id, store_id, name, phone) VALUES (1, 1, 'Timezone Customer', '9999999999')"
  );

  // 4. Insert three sales corresponding to the test times
  console.log("💾 Ingesting test sales...");
  await dbProxy.execute(
    "INSERT INTO sales (id, store_id, invoice_number, customer_id, payment_method, subtotal, discount, gst, grand_total, created_at) VALUES (1, 1, 'INV-TZ-A', 1, 'Cash', 1500, 0, 0, 1500, ?)",
    [timeA]
  );
  await dbProxy.execute(
    "INSERT INTO sales (id, store_id, invoice_number, customer_id, payment_method, subtotal, discount, gst, grand_total, created_at) VALUES (2, 1, 'INV-TZ-B', 1, 'UPI', 1500, 0, 0, 1500, ?)",
    [timeB]
  );
  await dbProxy.execute(
    "INSERT INTO sales (id, store_id, invoice_number, customer_id, payment_method, subtotal, discount, gst, grand_total, created_at) VALUES (3, 1, 'INV-TZ-C', 1, 'Card', 1500, 0, 0, 1500, ?)",
    [timeC]
  );

  // Insert corresponding sale items
  await dbProxy.execute(
    "INSERT INTO sale_items (id, sale_id, product_id, quantity, selling_price, discount, line_total) VALUES (1, 1, 1, 1, 1500, 0, 1500)"
  );
  await dbProxy.execute(
    "INSERT INTO sale_items (id, sale_id, product_id, quantity, selling_price, discount, line_total) VALUES (2, 2, 1, 1, 1500, 0, 1500)"
  );
  await dbProxy.execute(
    "INSERT INTO sale_items (id, sale_id, product_id, quantity, selling_price, discount, line_total) VALUES (3, 3, 1, 1, 1500, 0, 1500)"
  );

  console.log("✅ Test sales successfully ingested.");

  // 5. Query repositories
  const reportsRepo = new PostgresReportsRepository();
  const saleRepo = new PostgresSaleRepository();
  const dashboardRepo = new PostgresDashboardRepository();

  console.log("🔍 Running today summary verification...");
  
  // A. Reports summary
  const summary = await reportsRepo.getSummary("today");
  console.log("Reports Summary for Today:", summary);
  if (summary.orders !== 3) {
    console.error(`❌ Error: Expected 3 orders today, but got ${summary.orders}`);
    process.exit(1);
  }
  if (summary.revenue !== 45.0) {
    console.error(`❌ Error: Expected 45.00 INR revenue today, but got ${summary.revenue}`);
    process.exit(1);
  }
  console.log("✓ Reports summary verified successfully.");

  // B. Dashboard summary
  const dashSummary = await dashboardRepo.getTodaySummary();
  console.log("Dashboard Summary for Today:", dashSummary);
  if (dashSummary.todayOrders !== 3) {
    console.error(`❌ Error: Expected 3 today orders on dashboard, but got ${dashSummary.todayOrders}`);
    process.exit(1);
  }
  if (dashSummary.todayRevenue !== 45.0) {
    console.error(`❌ Error: Expected 45.00 INR today revenue on dashboard, but got ${dashSummary.todayRevenue}`);
    process.exit(1);
  }
  console.log("✓ Dashboard summary verified successfully.");

  // C. Sale repository today sales
  const todaySales = await saleRepo.getTodaySales();
  console.log("Today Sales count in sale repository:", todaySales.length);
  if (todaySales.length !== 3) {
    console.error(`❌ Error: Expected 3 sales in today sales, but got ${todaySales.length}`);
    process.exit(1);
  }
  
  const invoices = todaySales.map(s => s.invoice_number);
  if (!invoices.includes("INV-TZ-A") || !invoices.includes("INV-TZ-B") || !invoices.includes("INV-TZ-C")) {
    console.error("❌ Error: One or more test invoices are missing from today sales list!");
    process.exit(1);
  }
  console.log("✓ Today sales list verified successfully.");

  // D. Trend Series verification
  const trendSeries = await reportsRepo.getTrendSeries("today");
  console.log("Today Trend Series hourly entries:", JSON.stringify(trendSeries));
  // Total of value fields in trend series should sum to 45.0
  const trendSum = trendSeries.reduce((s, h) => s + h.value, 0);
  if (trendSum !== 45.0) {
    console.error(`❌ Error: Expected trend series values sum to be 45.0, but got ${trendSum}`);
    process.exit(1);
  }
  console.log("✓ Trend series verified successfully.");

  console.log("🎉 ALL TIMEZONE TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Test execution failed with error:", err);
  process.exit(1);
});
