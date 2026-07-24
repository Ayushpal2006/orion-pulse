import { db } from "../db";
import { products, sales, sale_items, inventory_movements } from "../db/schema";
import { storeStorage } from "../db/context";
import { CheckoutService } from "../services/checkout.service";
import { eq, and } from "drizzle-orm";
import assert from "assert";

async function runBillingE2ETest() {
  console.log("=================================================");
  console.log("🛒 ORION POS — BILLING (CHECKOUT) E2E TEST");
  console.log("=================================================\n");

  const storeId = 1;
  const checkoutService = new CheckoutService();

  await storeStorage.run({ storeId, userId: 1, role: "Admin" }, async () => {
    // 1. Fetch initial stock of Wireless Optical Mouse (product_id = 1)
    const [initialProduct] = await db.select().from(products).where(eq(products.id, 1));
    console.log("📦 Product state before billing:", {
      id: initialProduct.id,
      name: initialProduct.name,
      stock: initialProduct.stock,
      average_cost: initialProduct.average_cost,
      selling_price: initialProduct.selling_price,
    });

    const initialStock = initialProduct.stock;
    const checkoutQty = 3;

    // 2. Perform Checkout / Bill creation
    const checkoutReq = {
      idempotencyKey: `BILL-E2E-${Date.now()}`,
      items: [
        {
          productId: 1,
          quantity: checkoutQty,
          price: 999, // 999 INR
        },
      ],
      discountAmount: 0,
      taxAmount: 0,
      paymentMethod: "Cash",
      paidAmount: 2997,
      customerName: "Walk-in Customer",
      customerPhone: "0000000000",
      notes: "E2E Billing Validation",
    };

    console.log("\n▶ Executing Checkout Service executeCheckout call...");
    const checkoutRes = await checkoutService.executeCheckout(checkoutReq);
    console.log("Checkout Response:", JSON.stringify(checkoutRes, null, 2));

    // 3. Verify Product Stock post-checkout
    const [postProduct] = await db.select().from(products).where(eq(products.id, 1));
    console.log("\n📦 Product state after billing:", {
      id: postProduct.id,
      stock: postProduct.stock,
      expectedStock: initialStock - checkoutQty,
    });

    assert.strictEqual(postProduct.stock, initialStock - checkoutQty, `Stock must decrease by ${checkoutQty} from ${initialStock} to ${initialStock - checkoutQty}`);

    // 4. Verify Sales and Sale Items tables
    const [saleRecord] = await db.select().from(sales).where(eq(sales.invoice_number, checkoutRes.invoice));
    assert.ok(saleRecord, "Sale record must exist in sales table");

    const saleItems = await db.select().from(sale_items).where(eq(sale_items.sale_id, saleRecord.id));
    assert.strictEqual(saleItems.length, 1, "Sale item must exist in sale_items table");

    // 5. Verify Inventory Movement logged for SALE
    const saleMovements = await db
      .select()
      .from(inventory_movements)
      .where(and(eq(inventory_movements.product_id, 1), eq(inventory_movements.movement_type, "SALE")));
    assert.ok(saleMovements.length > 0, "Inventory movement with movement_type = SALE must be recorded");

    console.log("\n=================================================");
    console.log("✨ BILLING (CHECKOUT) E2E TEST PASSED 100% CLEANLY!");
    console.log("=================================================");
  });

  process.exit(0);
}

runBillingE2ETest().catch((err) => {
  console.error("❌ Billing E2E Test Failed:", err);
  process.exit(1);
});
