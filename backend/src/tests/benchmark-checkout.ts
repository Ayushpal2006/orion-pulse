import { storeStorage } from "../db/context";
import { CheckoutService } from "../services/checkout.service";
import { db } from "../db";
import { products, customers, stores, organizations } from "../db/schema";
import { eq } from "drizzle-orm";

async function runCheckoutBenchmark() {
  console.log("==================================================");
  console.log("⏱️ CHECKOUT ENDPOINT PERFORMANCE PROFILING BENCHMARK");
  console.log("==================================================\n");

  const checkoutService = new CheckoutService();

  // Setup mock tenant context
  const targetOrgId = 1;
  const targetStoreId = 1;

  await storeStorage.run(
    { organizationId: targetOrgId, currentStoreId: targetStoreId, userId: 1, role: "admin" },
    async () => {
      try {
        // Ensure at least 1 test product exists
        const [existingProd] = await db.select().from(products).where(eq(products.store_id, targetStoreId)).limit(1);
        let prodId = existingProd?.id;

        if (!prodId) {
          const [newProd] = await db.insert(products).values({
            organization_id: targetOrgId,
            store_id: targetStoreId,
            name: "Profiling Test Item",
            sku: `PROF-${Date.now()}`,
            purchase_price: 100,
            selling_price: 150,
            stock: 500,
            gst: 18,
            is_active: 1,
          }).returning();
          prodId = newProd.id;
        }

        const checkoutPayload = {
          customerId: undefined,
          customerName: "Profiling Customer",
          customerPhone: "9998887776",
          cashierName: "Profiler Admin",
          paymentMethod: "Cash" as const,
          items: [
            {
              productId: prodId,
              quantity: 2,
              discount: 0,
            },
          ],
        };

        console.log("🚀 Executing Instrumented Checkout Request...");
        const tStart = performance.now();
        const result = await checkoutService.executeCheckout(checkoutPayload);
        const tTotal = performance.now() - tStart;

        const timings = result.timings || {};

        console.log("\n==================================================");
        console.log("📊 PROFILING TIMING RESULTS & BREAKDOWN");
        console.log("==================================================");
        console.log(`1. Pre-Checkout Validation & Settings: ${timings.preCheck || "0.00"} ms`);
        console.log(`2. Customer Lookup / Create:           ${timings.customerLookup || "0.00"} ms`);
        console.log(`3. Invoice Number Generation:          ${timings.invoiceGen || "0.00"} ms`);
        console.log(`4. Product & Stock Deduction:          ${timings.inventoryDeduction || "0.00"} ms`);
        console.log(`5. Sale Record Insert:                 ${timings.saleInsert || "0.00"} ms`);
        console.log(`6. Audit Log Insert:                   ${timings.auditInsert || "0.00"} ms`);
        console.log(`7. Sale Items Batch Insert:            ${timings.itemsInsert || "0.00"} ms`);
        console.log(`8. Customer Profile Update:            ${timings.customerUpdate || "0.00"} ms`);
        console.log(`--------------------------------------------------`);
        console.log(`DB Transaction Total:                  ${timings.dbTransactionTotal || "0.00"} ms`);
        console.log(`--------------------------------------------------`);
        console.log(`9. Receipt Snapshot & WhatsApp Prep:   ${timings.receiptPrep || "0.00"} ms`);
        console.log(`--------------------------------------------------`);
        console.log(`TOTAL CHECKOUT DURATION:               ${tTotal.toFixed(2)} ms`);
        console.log("==================================================\n");

        process.exit(0);
      } catch (err: any) {
        console.error("❌ Benchmark failed:", err.message || err);
        process.exit(1);
      }
    }
  );
}

runCheckoutBenchmark();
