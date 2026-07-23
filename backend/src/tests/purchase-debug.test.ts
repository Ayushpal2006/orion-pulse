import { db } from "../db";
import { suppliers, products, purchase_orders } from "../db/schema";
import { storeStorage } from "../db/context";
import { PurchaseService } from "../services/purchase.service";
import { eq } from "drizzle-orm";

async function runTest() {
  console.log("🚀 Starting Purchase Creation Debug Test...");

  // 1. Get or create a supplier
  let [supplier] = await db.select().from(suppliers).where(eq(suppliers.store_id, 1)).limit(1);
  if (!supplier) {
    [supplier] = await db.insert(suppliers).values({
      store_id: 1,
      supplier_code: "SUP-001",
      company_name: "Test Supplier",
    }).returning();
    console.log("Created test supplier ID:", supplier.id);
  } else {
    console.log("Using existing supplier ID:", supplier.id);
  }

  // 2. Get or create a product
  let [product] = await db.select().from(products).where(eq(products.store_id, 1)).limit(1);
  if (!product) {
    [product] = await db.insert(products).values({
      store_id: 1,
      name: "Test Item",
      sku: "TEST-SKU-001",
      purchase_price: 10000,
      selling_price: 15000,
      stock: 10,
    }).returning();
    console.log("Created test product ID:", product.id);
  } else {
    console.log("Using existing product ID:", product.id);
  }

  const purchaseService = new PurchaseService();

  const payload = {
    supplier_id: supplier.id,
    po_number: `TEST-PO-${Date.now()}`,
    items: [
      {
        product_id: product.id,
        quantity: 2,
        purchase_price: 120, // 120 INR = 12000 Paise
        selling_price: 180, // 180 INR = 18000 Paise
      },
    ],
    payment_status: "Pending",
    notes: "Debug test purchase order",
  };

  console.log("📦 Test Payload:", JSON.stringify(payload, null, 2));

  await storeStorage.run({ storeId: 1, userId: 1, role: "Admin" }, async () => {
    try {
      const result = await purchaseService.create(payload);
      console.log("✅ PURCHASE CREATION SUCCESSFUL! Result:", result);
    } catch (err: any) {
      console.error("❌ PURCHASE CREATION FAILED IN TEST RUNNER!");
      console.error("Error message:", err?.message);
      console.error("Error detail:", err?.detail);
      console.error("Error constraint:", err?.constraint);
      console.error("Error table:", err?.table);
      console.error("Error column:", err?.column);
      console.error("Error code:", err?.code);
      console.error("Full error object:", err);
    }
  });

  process.exit(0);
}

runTest();
