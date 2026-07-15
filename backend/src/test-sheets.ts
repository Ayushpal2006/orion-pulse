import { storeStorage } from "./db/context";
import { ProductService } from "./services/product.service";
import { CustomerService } from "./services/customer.service";
import { CheckoutService } from "./services/checkout.service";
import { SyncQueueManager } from "./services/sync.service";
import { settingsRepository } from "./repositories";
import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🚀 Starting Google Sheets Sync E2E Test...");

  // Run E2E actions under active store context (Store ID = 1)
  await storeStorage.run({ storeId: 1, userId: 1, role: "admin" }, async () => {
    // 1. Setup sync settings
    const sheetId = await settingsRepository.get("google_sheet_id", "");
    const enabled = await settingsRepository.get("google_sync_enabled", "0");
    console.log(`Configured Google Sheet ID: "${sheetId}"`);
    console.log(`Sync Enabled status: "${enabled}"`);
    
    if (!sheetId) {
      console.error("❌ Error: google_sheet_id is not configured in settings table!");
      process.exit(1);
    }
    
    if (enabled !== "1") {
      console.log("⚠️ Google sync is disabled. Enabling temporarily for testing...");
      await settingsRepository.set("google_sync_enabled", "1");
    }

    const productService = new ProductService();
    const customerService = new CustomerService();
    const checkoutService = new CheckoutService();

    const testSku = "TS-E2E-PRODUCT";
    const testPhone = "9988776655";

    // Clean up previous test remnants to start with a fresh state
    console.log("🧹 Cleaning up old E2E test remnants from PostgreSQL...");
    await db.execute(sql`DELETE FROM sale_items WHERE product_id IN (SELECT id FROM products WHERE sku = ${testSku})`);
    await db.execute(sql`DELETE FROM inventory_logs WHERE product_id IN (SELECT id FROM products WHERE sku = ${testSku})`);
    await db.execute(sql`DELETE FROM products WHERE sku = ${testSku}`);
    await db.execute(sql`DELETE FROM customers WHERE phone = ${testPhone}`);

    // Retrieve Sync Queue Manager instance
    const queue = SyncQueueManager.getInstance();
    
    // E2E Step 1: Create Product
    console.log("\n📦 1. Creating Product...");
    const product = await productService.create({
      name: "E2E Test Product",
      sku: testSku,
      purchase_price: 10000, // INR 100.00
      selling_price: 15000,  // INR 150.00
      stock: 20,
      gst: 18,
    });
    console.log(`Product created: ID ${product.id}, SKU: ${product.sku}`);

    // E2E Step 2: Edit Product (update price & stock)
    console.log("\n📦 2. Editing Product (Updating Selling Price & Stock)...");
    const updatedProduct = await productService.update(product.id, {
      selling_price: 16000, // INR 160.00
      stock: 25,
    });
    console.log(`Product updated: SKU ${updatedProduct.sku}, New Price ${updatedProduct.selling_price / 100}`);

    // E2E Step 3: Create Customer
    console.log("\n👤 3. Creating Customer...");
    const customer = await customerService.create({
      name: "E2E Test Customer",
      phone: testPhone,
      email: "e2e@test.com",
      address: "123 Test Street",
    });
    console.log(`Customer created: ID ${customer.id}, Phone: ${customer.phone}`);

    // E2E Step 4: Edit Customer
    console.log("\n👤 4. Editing Customer...");
    const updatedCustomer = await customerService.update(customer.id, {
      name: "E2E Test Customer Updated",
    });
    console.log(`Customer updated: Phone ${updatedCustomer.phone}, New Name: ${updatedCustomer.name}`);

    // E2E Step 5: Complete Sale
    console.log("\n💳 5. Completing Sale (Triggers Sale, Customer update, Product stock update sync)...");
    const saleResult = await checkoutService.checkout({
      idempotencyKey: "e2e-checkout-" + Date.now(),
      cashierName: "E2E Tester",
      customerPhone: testPhone,
      customerName: "E2E Test Customer Updated",
      paymentMethod: "UPI",
      discount: 1000, // INR 10.00
      items: [
        {
          productId: product.id,
          quantity: 2,
          sellingPrice: 16000,
          discount: 0,
          lineTotal: 32000,
        }
      ]
    });
    console.log(`Sale completed: Invoice ${saleResult.invoice}, Grand Total ${saleResult.grandTotal / 100}`);

    // Let's print out queue status and wait for it to process
    console.log("\n⏳ Waiting for background Google Sheets synchronization queue to finish...");
    let stats = await queue.getSyncStatus();
    console.log(`Initial Queue Status: Pending ${stats.pendingJobs}, Failed ${stats.failedJobs}`);
    
    // Wait for jobs to process (up to 15 seconds)
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      stats = await queue.getSyncStatus();
      console.log(`Queue Status: Pending ${stats.pendingJobs}, Failed ${stats.failedJobs}`);
      if (stats.pendingJobs === 0) {
        break;
      }
    }

    if (stats.failedJobs > 0) {
      console.error(`❌ E2E sync completed with ${stats.failedJobs} failed jobs. Check the backend logs.`);
      process.exit(1);
    } else {
      console.log("🎉 E2E Sync Completed Successfully! Check your Google Sheets tab!");
    }
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ E2E script failed with error:", err);
  process.exit(1);
});
