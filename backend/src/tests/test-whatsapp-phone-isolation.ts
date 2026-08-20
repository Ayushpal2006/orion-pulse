import assert from "node:assert";
import { db } from "../db";
import { customers, sales, sale_items, products, stores, organizations } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { CheckoutService } from "../services/checkout.service";
import { SalesService } from "../services/sales.service";
import { ShareService, normalizeWhatsAppPhone } from "../services/share.service";
import { storeStorage } from "../db/context";

async function runWhatsAppPhoneTests() {
  console.log("================================================================================");
  console.log("🧪 RUNNING WHATSAPP INVOICE PHONE TARGET & ISOLATION TESTS");
  console.log("================================================================================");

  // 1. Setup Organizations and Stores
  const [orgA] = await db.select().from(organizations).where(eq(organizations.id, 1)).limit(1);
  const [storeA] = await db.select().from(stores).where(eq(stores.id, 1)).limit(1);

  assert.ok(orgA && storeA, "Organization 1 and Store 1 must exist");

  // Create a dummy product for testing checkout
  let [testProduct] = await db
    .select()
    .from(products)
    .where(and(eq(products.store_id, 1), eq(products.is_active, 1)))
    .limit(1);

  if (!testProduct) {
    [testProduct] = await db
      .insert(products)
      .values({
        organization_id: 1,
        store_id: 1,
        name: "Test T-Shirt",
        sku: `SKU-TEST-${Date.now()}`,
        barcode: `890${Date.now()}`,
        selling_price: 50000, // ₹500
        purchase_price: 25000,
        stock: 100,
        minimum_stock: 5,
        is_active: 1,
      })
      .returning();
  }

  const checkoutService = new CheckoutService();
  const salesService = new SalesService();
  const shareService = new ShareService();

  // ============================================================================
  // NORMALIZATION UNIT TESTS
  // ============================================================================
  console.log("\n▶️ Step 0: Phone normalization checks");
  assert.equal(normalizeWhatsAppPhone("9315900307"), "919315900307");
  assert.equal(normalizeWhatsAppPhone("+919315900307"), "919315900307");
  assert.equal(normalizeWhatsAppPhone("+91 93159 00307"), "919315900307");
  assert.equal(normalizeWhatsAppPhone("09315900307"), "919315900307");
  assert.equal(normalizeWhatsAppPhone("93159-00307"), "919315900307");
  assert.equal(normalizeWhatsAppPhone("0000000000"), null);
  assert.equal(normalizeWhatsAppPhone(""), null);
  assert.equal(normalizeWhatsAppPhone(null), null);
  assert.equal(normalizeWhatsAppPhone(undefined), null);
  console.log("   ✅ Normalization unit tests passed.");

  await storeStorage.run(
    { organizationId: 1, currentStoreId: 1, userId: 1, role: "admin" },
    async () => {
      // ============================================================================
      // TEST 1: Customer A (Phone: 9315900307)
      // ============================================================================
      console.log("\n▶️ TEST 1: Customer A (Phone: 9315900307)");
      const resA = await checkoutService.executeCheckout({
        customerName: "Rahul Sharma",
        customerPhone: "9315900307",
        paymentMethod: "UPI",
        cashierName: "Admin",
        items: [{ productId: testProduct.id, quantity: 1 }],
      });

      console.log("   Invoice A created:", resA.invoice);
      assert.ok(resA.whatsappUrl, "WhatsApp URL should be prepared for Customer A");
      assert.ok(
        resA.whatsappUrl.startsWith("https://wa.me/919315900307?text="),
        `Customer A WhatsApp URL must target 919315900307, got: ${resA.whatsappUrl}`
      );

      // Verify receipt lookup as well
      const receiptA = await salesService.getReceipt(resA.invoice);
      const urlFromReceiptA = shareService.generateWhatsAppLink(receiptA);
      assert.ok(
        urlFromReceiptA.startsWith("https://wa.me/919315900307?text="),
        `Receipt A WhatsApp link must target 919315900307, got: ${urlFromReceiptA}`
      );
      console.log("   ✅ TEST 1 PASSED: Target phone is wa.me/919315900307");

      // ============================================================================
      // TEST 2: Customer B (Phone: 9876543210) — Sequential bill immediately after
      // Same customer name "Rahul Sharma" to strictly verify phone-based isolation!
      // ============================================================================
      console.log("\n▶️ TEST 2: Customer B (Phone: 9876543210, Name: Rahul Sharma)");
      const resB = await checkoutService.executeCheckout({
        customerName: "Rahul Sharma",
        customerPhone: "9876543210",
        paymentMethod: "Cash",
        cashierName: "Admin",
        items: [{ productId: testProduct.id, quantity: 1 }],
      });

      console.log("   Invoice B created:", resB.invoice);
      assert.ok(resB.whatsappUrl, "WhatsApp URL should be prepared for Customer B");
      assert.ok(
        resB.whatsappUrl.startsWith("https://wa.me/919876543210?text="),
        `Customer B WhatsApp URL must target 919876543210, got: ${resB.whatsappUrl}`
      );
      assert.ok(
        !resB.whatsappUrl.includes("9315900307"),
        "Customer B MUST NOT leak Customer A's phone number!"
      );

      const receiptB = await salesService.getReceipt(resB.invoice);
      const urlFromReceiptB = shareService.generateWhatsAppLink(receiptB);
      assert.ok(
        urlFromReceiptB.startsWith("https://wa.me/919876543210?text="),
        `Receipt B WhatsApp link must target 919876543210, got: ${urlFromReceiptB}`
      );
      console.log("   ✅ TEST 2 PASSED: Sequential bill targets wa.me/919876543210 without leakage");

      // ============================================================================
      // TEST 3: Walk-in customer with manually entered phone (+91 91234 56789)
      // ============================================================================
      console.log("\n▶️ TEST 3: Walk-in with manually entered formatted phone (+91 91234 56789)");
      const resC = await checkoutService.executeCheckout({
        customerName: "Walk-in Customer",
        customerPhone: "+91 91234 56789",
        paymentMethod: "Card",
        cashierName: "Admin",
        items: [{ productId: testProduct.id, quantity: 1 }],
      });

      console.log("   Invoice C created:", resC.invoice);
      assert.ok(resC.whatsappUrl, "WhatsApp URL should be prepared");
      assert.ok(
        resC.whatsappUrl.startsWith("https://wa.me/919123456789?text="),
        `Manual phone WhatsApp URL must target 919123456789, got: ${resC.whatsappUrl}`
      );
      console.log("   ✅ TEST 3 PASSED: Manual formatted phone targets wa.me/919123456789");

      // ============================================================================
      // TEST 4: Customer with no phone (or dummy 0000000000)
      // ============================================================================
      console.log("\n▶️ TEST 4: Customer with no phone / dummy 0000000000");
      const resD = await checkoutService.executeCheckout({
        customerName: "Walk-in Customer",
        customerPhone: "0000000000",
        paymentMethod: "Cash",
        cashierName: "Admin",
        items: [{ productId: testProduct.id, quantity: 1 }],
      });

      console.log("   Invoice D created:", resD.invoice);
      assert.equal(resD.whatsappUrl, undefined, "whatsappUrl must be undefined when customer has no valid phone");
      assert.equal(resD.whatsappPrepared, false);

      const receiptD = await salesService.getReceipt(resD.invoice);
      let errorThrown = false;
      try {
        shareService.generateWhatsAppLink(receiptD);
      } catch (err: any) {
        errorThrown = true;
        assert.ok(
          err.message.includes("Customer phone number is required"),
          `Expected clear error message, got: ${err.message}`
        );
      }
      assert.ok(errorThrown, "generateWhatsAppLink must throw when phone is missing");
      console.log("   ✅ TEST 4 PASSED: Missing phone safely blocks sharing with clear error");

      // ============================================================================
      // TEST 6: Refresh and share existing invoice
      // ============================================================================
      console.log("\n▶️ TEST 6: Fetch existing invoices and verify individual recipient targets");
      const fetchedA = await salesService.getReceipt(resA.invoice);
      const fetchedB = await salesService.getReceipt(resB.invoice);
      assert.equal(shareService.generateWhatsAppLink(fetchedA).split("?")[0], "https://wa.me/919315900307");
      assert.equal(shareService.generateWhatsAppLink(fetchedB).split("?")[0], "https://wa.me/919876543210");
      console.log("   ✅ TEST 6 PASSED: Existing invoices resolve their own respective customer phones");
    }
  );

  console.log("\n================================================================================");
  console.log("🎉 ALL WHATSAPP PHONE TARGET & ISOLATION TESTS PASSED 100%!");
  console.log("================================================================================");
}

runWhatsAppPhoneTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ TEST FAILURE:", err);
    process.exit(1);
  });
