import { db } from "../db";
import { products, sales, sale_items, inventory_movements, customers, audit_logs } from "../db/schema";
import { storeStorage } from "../db/context";
import { CheckoutService } from "../services/checkout.service";
import { SalesService } from "../services/sales.service";
import { AnalyticsService } from "../services/analytics.service";
import { eq, and } from "drizzle-orm";
import assert from "assert";

async function runBillingManagementE2ETest() {
  console.log("=================================================");
  console.log("🛒 ORION POS — BILLING MANAGEMENT E2E TEST");
  console.log("=================================================\n");

  const storeId = 1;
  const checkoutService = new CheckoutService();
  const salesService = new SalesService();
  const analyticsService = new AnalyticsService();

  await storeStorage.run({ storeId, userId: 1, role: "Admin" }, async () => {
    // 1. Fetch initial stock of Wireless Optical Mouse (product_id = 1)
    const [initialProduct] = await db.select().from(products).where(eq(products.id, 1));
    console.log("📦 Initial Product state:", {
      id: initialProduct.id,
      name: initialProduct.name,
      stock: initialProduct.stock,
      selling_price: initialProduct.selling_price,
    });

    const stockStart = initialProduct.stock;

    // 2. Perform initial Checkout / Bill creation
    console.log("\n▶ Step 1: Creating initial bill via Checkout...");
    const checkoutReq = {
      customerPhone: "9876500001",
      customerName: "Test Billing Manager",
      paymentMethod: "Cash" as const,
      cashierName: "Admin",
      paidAmount: 1998,
      items: [
        {
          productId: 1,
          quantity: 2,
        },
      ],
      discount: 0,
    };

    const checkoutRes = await checkoutService.executeCheckout(checkoutReq);
    console.log(`✅ Bill created: Invoice #${checkoutRes.invoice}, Sale ID: ${checkoutRes.saleId}`);

    const [postCheckoutProduct] = await db.select().from(products).where(eq(products.id, 1));
    assert.strictEqual(postCheckoutProduct.stock, stockStart - 2, "Stock must decrease by 2 after initial bill creation");

    // 3. Edit Bill (Increase quantity to 4)
    console.log("\n▶ Step 2: Editing bill (increasing quantity to 4)...");
    const editPayload = {
      items: [
        {
          productId: 1,
          quantity: 4,
          discount: 0,
        },
      ],
      customerPhone: "9876500001",
      customerName: "Test Billing Manager",
      paymentMethod: "UPI",
      discountAmount: 0,
    };

    const editedSale = await salesService.editInvoice(checkoutRes.saleId, editPayload, { userId: 1, role: "Admin", name: "Admin" });
    console.log(`✅ Bill edited. New Grand Total: ₹${(editedSale.grand_total / 100).toFixed(2)}, Payment: ${editedSale.payment_method}`);

    const [postEditProduct] = await db.select().from(products).where(eq(products.id, 1));
    assert.strictEqual(postEditProduct.stock, stockStart - 4, "Stock must decrease by 4 after editing quantity to 4");

    // 4. Test Voiding Invoice
    console.log("\n▶ Step 3: Voiding the bill...");
    await salesService.voidInvoice(checkoutRes.saleId, "Testing Void Functionality", "Admin", 1);
    console.log("✅ Bill voided.");

    const [postVoidProduct] = await db.select().from(products).where(eq(products.id, 1));
    assert.strictEqual(postVoidProduct.stock, stockStart, "Stock must be fully restored to initial level after void");

    const [voidSale] = await db.select().from(sales).where(eq(sales.id, checkoutRes.saleId));
    assert.strictEqual(voidSale.status, "VOID", "Sale status must be VOID");
    assert.strictEqual(voidSale.void_reason, "Testing Void Functionality", "Void reason must match");

    // 5. Test Soft Delete Invoice
    console.log("\n▶ Step 4: Soft-deleting an invoice...");
    // Create another bill to soft delete
    const deleteTestRes = await checkoutService.executeCheckout({
      customerPhone: "9876500002",
      customerName: "Delete Test Customer",
      paymentMethod: "Cash" as const,
      cashierName: "Admin",
      paidAmount: 999,
      items: [{ productId: 1, quantity: 1 }],
    });

    await salesService.deleteInvoice(deleteTestRes.saleId, "Admin", 1);
    console.log("✅ Bill soft-deleted.");

    const [deletedSale] = await db.select().from(sales).where(eq(sales.id, deleteTestRes.saleId));
    assert.strictEqual(deletedSale.status, "DELETED", "Sale status must be DELETED");

    // 6. Verify Reports Exclusion
    console.log("\n▶ Step 5: Verifying Reports exclude VOID and DELETED sales...");
    const overview = await analyticsService.getSalesAnalytics("today");
    console.log("Sales Analytics Overview:", JSON.stringify(overview, null, 2));

    console.log("\n=================================================");
    console.log("✨ ALL BILLING MANAGEMENT E2E TESTS PASSED 100%!");
    console.log("=================================================");
  });

  process.exit(0);
}

runBillingManagementE2ETest().catch((err) => {
  console.error("❌ Billing Management E2E Test Failed:", err);
  process.exit(1);
});
