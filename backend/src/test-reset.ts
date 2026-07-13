import dbProxy from "./database";
import { signHS256JWT } from "./middleware/admin-auth.middleware";
import { env } from "./config/env";
import fs from "fs";
import path from "path";

const PORT = process.env.PORT || "8089";
const BASE_URL = `http://localhost:${PORT}`;

// Helper to wait
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("🚀 Starting Reset Demo Data Integration Tests...");

  // 1. Wait for server to be up and running
  let retries = 10;
  let serverReady = false;
  while (retries > 0) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch (e) {
      // Server not ready yet
    }
    console.log(`⏳ Waiting for server to start (${retries} attempts left)...`);
    await sleep(1000);
    retries--;
  }

  if (!serverReady) {
    console.error("❌ Error: Server failed to start on port", PORT);
    process.exit(1);
  }
  console.log("✅ Server is online at:", BASE_URL);

  // 2. Clear and seed the database with clean test data
  console.log("🌱 Seeding test data...");
  
  // Clear any existing transactional records to avoid conflicts
  await dbProxy.execute("DELETE FROM sale_items;");
  await dbProxy.execute("DELETE FROM sales;");
  await dbProxy.execute("DELETE FROM products;");
  await dbProxy.execute("DELETE FROM customers;");
  await dbProxy.execute("DELETE FROM sync_jobs;");

  // Create dummy product image uploads
  const productsDir = path.resolve(__dirname, "../uploads/products");
  if (!fs.existsSync(productsDir)) {
    fs.mkdirSync(productsDir, { recursive: true });
  }
  const testImagePath = path.join(productsDir, "test-prod-img.png");
  fs.writeFileSync(testImagePath, "fake image content");
  console.log("📸 Created test product image:", testImagePath);

  // Create dummy PDF invoice
  const invoicesDir = path.resolve(__dirname, "../uploads/invoices");
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }
  const testInvoicePath = path.join(invoicesDir, "INV-TEST-01.pdf");
  fs.writeFileSync(testInvoicePath, "fake pdf content");
  console.log("📑 Created test invoice PDF:", testInvoicePath);

  // Insert seed data
  await dbProxy.execute(
    "INSERT INTO products (id, name, sku, purchase_price, selling_price, stock, minimum_stock, image_url) VALUES (1, 'Test Product', 'TEST-PROD-01', 1000, 1500, 10, 2, '/uploads/products/test-prod-img.png')"
  );
  await dbProxy.execute(
    "INSERT INTO customers (id, name, phone) VALUES (1, 'Test Customer', '9999999999')"
  );
  await dbProxy.execute(
    "INSERT INTO sales (id, invoice_number, customer_id, payment_method, subtotal, discount, gst, grand_total, created_at) VALUES (1, 'INV-TEST-01', 1, 'Cash', 1500, 0, 0, 1500, datetime('now'))"
  );
  await dbProxy.execute(
    "INSERT INTO sale_items (id, sale_id, product_id, quantity, selling_price, discount, line_total) VALUES (1, 1, 1, 1, 1500, 0, 1500)"
  );
  await dbProxy.execute(
    "INSERT INTO sync_jobs (id, job_type, payload, status) VALUES (1, 'sheets_sync', 'some_payload', 'pending')"
  );
  console.log("✅ Seed data successfully inserted.");

  // 3. Verify seeded data exists in database
  const seededProdCount = await dbProxy.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM products");
  const seededCustCount = await dbProxy.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM customers");
  const seededSaleCount = await dbProxy.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM sales");
  
  if (seededProdCount?.count !== 1 || seededCustCount?.count !== 1 || seededSaleCount?.count !== 1) {
    console.error("❌ Error: Seed data verification failed.");
    process.exit(1);
  }
  console.log("✅ Seed verification complete.");

  // 4. Test security: Unauthenticated POST
  console.log("🔒 Verifying authentication protections...");
  const noAuthRes = await fetch(`${BASE_URL}/api/admin/reset-demo-data`, {
    method: "POST",
  });
  console.log("NoAuth status:", noAuthRes.status);
  if (noAuthRes.status !== 401) {
    console.error("❌ Error: Production route allowed unauthenticated access!");
    process.exit(1);
  }
  console.log("✅ Unauthenticated request successfully blocked (401).");

  // 5. Test security: Invalid role (non-admin)
  const userToken = signHS256JWT({ role: "cashier", username: "cashier-john" }, env.JWT_SECRET);
  const badRoleRes = await fetch(`${BASE_URL}/api/admin/reset-demo-data`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${userToken}`,
    },
  });
  console.log("BadRole status:", badRoleRes.status);
  if (badRoleRes.status !== 403) {
    console.error("❌ Error: Route allowed non-admin role access!");
    process.exit(1);
  }
  console.log("✅ Unauthorized role successfully blocked (403).");

  // 6. Test security: Valid admin token -> should execute successfully
  const adminToken = signHS256JWT({ role: "admin", username: "admin-rohan" }, env.JWT_SECRET);
  console.log("🔑 Making reset request with valid admin token...");
  const resetRes = await fetch(`${BASE_URL}/api/admin/reset-demo-data`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${adminToken}`,
    },
  });

  if (resetRes.status !== 200) {
    console.error("❌ Error: Reset endpoint failed with status:", resetRes.status);
    const text = await resetRes.text();
    console.error("Response body:", text);
    process.exit(1);
  }

  const resetBody = await resetRes.json();
  console.log("✅ Reset Response:", JSON.stringify(resetBody, null, 2));

  // Verify response format and numbers
  const summary = resetBody.data;
  if (
    summary.productsDeleted !== 1 ||
    summary.customersDeleted !== 1 ||
    summary.salesDeleted !== 1 ||
    summary.invoicesDeleted !== 1
  ) {
    console.error("❌ Error: Reset summary deleted counts are incorrect!");
    process.exit(1);
  }
  console.log("✅ Deleted counts returned correctly.");

  // 7. Verify file cleanup on disk
  console.log("📁 Verifying file cleanup on disk...");
  if (fs.existsSync(testImagePath)) {
    console.error("❌ Error: Product image was not deleted from disk!");
    process.exit(1);
  }
  if (fs.existsSync(testInvoicePath)) {
    console.error("❌ Error: Invoice PDF was not deleted from disk!");
    process.exit(1);
  }
  console.log("✅ Uploaded files successfully cleaned up.");

  // 8. Verify database is empty
  console.log("🗄️ Checking if database tables are empty...");
  const postProd = await dbProxy.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM products");
  const postCust = await dbProxy.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM customers");
  const postSale = await dbProxy.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM sales");
  const postSaleItem = await dbProxy.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM sale_items");
  const postSyncJob = await dbProxy.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM sync_jobs");

  if (
    postProd?.count !== 0 ||
    postCust?.count !== 0 ||
    postSale?.count !== 0 ||
    postSaleItem?.count !== 0 ||
    postSyncJob?.count !== 0
  ) {
    console.error("❌ Error: Database tables are not completely empty!");
    process.exit(1);
  }
  console.log("✅ Database tables verified empty.");

  // 9. Verify dashboard dashboard values are zero
  console.log("📊 Checking dashboard values...");
  const dashRes = await fetch(`${BASE_URL}/dashboard`);
  const dashData = await dashRes.json();
  console.log("Dashboard response:", JSON.stringify(dashData, null, 2));
  
  const dashSummary = dashData.data;
  if (
    dashSummary.todayRevenue !== 0 ||
    dashSummary.todayOrders !== 0 ||
    dashSummary.todayProfit !== 0 ||
    dashSummary.inventoryCount !== 0 ||
    dashSummary.lowStockCount !== 0 ||
    dashSummary.topProducts.length !== 0 ||
    dashSummary.recentSales.length !== 0
  ) {
    console.error("❌ Error: Dashboard summary is not completely zero!");
    process.exit(1);
  }
  console.log("✅ Dashboard is verified at zero/empty.");

  // 10. Verify reports are empty
  console.log("📈 Checking reports values...");
  const reportsRes = await fetch(`${BASE_URL}/reports?filter=today`);
  const reportsData = await reportsRes.json();
  console.log("Reports summary response:", JSON.stringify(reportsData, null, 2));
  const reportsSummary = reportsData.data;
  if (
    reportsSummary.revenue !== 0 ||
    reportsSummary.orders !== 0 ||
    reportsSummary.profit !== 0 ||
    reportsSummary.averageOrderValue !== 0
  ) {
    console.error("❌ Error: Reports summary is not completely empty/zero!");
    process.exit(1);
  }
  console.log("✅ Reports are verified at zero/empty.");

  // 11. Verify AUTOINCREMENT sequence reset (insert should start at ID 1)
  console.log("🔢 Verifying AUTOINCREMENT sequences restart at 1...");
  await dbProxy.execute(
    "INSERT INTO products (name, sku, purchase_price, selling_price, stock, minimum_stock) VALUES ('New Product', 'NEW-PROD', 500, 800, 20, 5)"
  );
  const newProduct = await dbProxy.queryOne<{ id: number }>("SELECT id FROM products LIMIT 1");
  console.log("New product ID inserted after reset:", newProduct?.id);
  
  if (newProduct?.id !== 1) {
    console.error("❌ Error: AUTOINCREMENT did not reset to 1! Got ID:", newProduct?.id);
    process.exit(1);
  }
  console.log("✅ AUTOINCREMENT sequence reset verified successfully.");

  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! factory reset is safe and operational.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Test script failed:", err);
  process.exit(1);
});
