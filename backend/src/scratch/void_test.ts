import "dotenv/config";
import { initDb } from "../database/init";
import { db } from "../db";
import { sales, products, customers, audit_logs, inventory_logs } from "../db/schema";
import { SalesService } from "../services/sales.service";
import { CheckoutService } from "../services/checkout.service";
import { eq, and, desc } from "drizzle-orm";
import { storeStorage } from "../db/context";

async function runTests() {
  console.log("🚀 Starting Void System Integration Tests...");

  // Initialize DB connection
  await initDb();

  // Run everything inside the storeStorage context (Store 1, User 1, Role: admin)
  await storeStorage.run({ storeId: 1, userId: 1, role: "admin" }, async () => {
    try {
      const checkoutService = new CheckoutService();
      const salesService = new SalesService();

      // 1. Pick a test product
      const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.store_id, 1), eq(products.is_active, 1)))
        .limit(1);

      if (!product) {
        throw new Error("No active product found for testing");
      }

      console.log(`📦 Selected test product: ${product.name} (SKU: ${product.sku}, Stock: ${product.stock})`);
      const initialStock = product.stock;

      // 2. Pick or create a test customer
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.store_id, 1))
        .limit(1);

      if (!customer) {
        throw new Error("No customer found for testing");
      }

      console.log(`👤 Selected test customer: ${customer.name} (LTV: ${customer.lifetime_value}, Orders: ${customer.total_orders})`);
      const initialLtv = customer.lifetime_value;
      const initialOrders = customer.total_orders;

      // 3. Perform a checkout
      console.log("🛒 Simulating a checkout...");
      const checkoutReq = {
        customerPhone: customer.phone,
        paymentMethod: "Cash" as const,
        cashierName: "Test Cashier",
        items: [
          {
            productId: product.id,
            quantity: 2,
            discount: 0,
          },
        ],
      };

      const checkoutRes = await checkoutService.checkout(checkoutReq);
      console.log(`✅ Checkout successful! Invoice: ${checkoutRes.invoice}`);

      // Verify stock decreased
      const [prodAfterCheckout] = await db
        .select()
        .from(products)
        .where(eq(products.id, product.id));
      console.log(`📉 Stock after checkout: ${prodAfterCheckout.stock} (expected: ${initialStock - 2})`);
      if (prodAfterCheckout.stock !== initialStock - 2) {
        throw new Error("Stock subtraction failed!");
      }

      // Verify customer totals increased
      const [custAfterCheckout] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customer.id));
      console.log(`📈 Customer LTV after checkout: ${custAfterCheckout.lifetime_value} (expected: ${initialLtv + checkoutRes.grandTotal * 100})`);
      if (custAfterCheckout.total_orders !== initialOrders + 1) {
        throw new Error("Customer orders count increment failed!");
      }

      // Get the created sale
      const [sale] = await db
        .select()
        .from(sales)
        .where(eq(sales.invoice_number, checkoutRes.invoice));

      if (!sale) {
        throw new Error("Created sale record not found in database!");
      }
      console.log(`📄 Created sale ID: ${sale.id}, Status: ${sale.status}`);

      // 4. Test transactional rollback on failure during void
      console.log("🛠️ Testing Transaction Rollback on Failure...");
      try {
        await db.transaction(async (tx) => {
          // Perform a partial update
          await tx
            .update(products)
            .set({ stock: 9999 })
            .where(eq(products.id, product.id));
            
          // Throw error to trigger rollback
          throw new Error("Forced transaction rollback error");
        });
      } catch (err: any) {
        console.log(`✔️ Expected failure caught: ${err.message}`);
      }

      // Verify stock was NOT modified
      const [prodAfterFailedTx] = await db
        .select()
        .from(products)
        .where(eq(products.id, product.id));
      console.log(`🛡️ Stock after aborted transaction: ${prodAfterFailedTx.stock} (expected: ${initialStock - 2})`);
      if (prodAfterFailedTx.stock !== initialStock - 2) {
        throw new Error("Transaction rollback failed! Stock changed.");
      }
      console.log("✅ Rollback validation successful!");

      // 5. Perform the actual Void Invoice action
      console.log("🟥 Triggering Void Invoice API/Service workflow...");
      const voidResult = await salesService.voidInvoice(sale.id, "Billing Mistake", "Admin Test User", 1);
      console.log(`✅ Void sequence finished! Status of sale is now: ${voidResult.sale.status}`);

      // Verify status is VOID
      if (voidResult.sale.status !== "VOID" || voidResult.sale.void_reason !== "Billing Mistake") {
        throw new Error("Sale status update to VOID failed!");
      }

      // Verify inventory restored
      const [prodAfterVoid] = await db
        .select()
        .from(products)
        .where(eq(products.id, product.id));
      console.log(`🔄 Stock after void: ${prodAfterVoid.stock} (expected: ${initialStock})`);
      if (prodAfterVoid.stock !== initialStock) {
        throw new Error("Inventory stock restoration failed!");
      }

      // Verify inventory log of type VOID
      const [invLog] = await db
        .select()
        .from(inventory_logs)
        .where(and(eq(inventory_logs.product_id, product.id), eq(inventory_logs.type, "VOID")))
        .orderBy(desc(inventory_logs.id))
        .limit(1);
      if (!invLog) {
        throw new Error("Inventory movement log of type VOID was not found!");
      }
      console.log(`📝 Logged inventory movement: Type = ${invLog.type}, Reference = ${invLog.reference}, Quantity = ${invLog.quantity}`);

      // Verify customer totals reversed
      const [custAfterVoid] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customer.id));
      console.log(`🔄 Customer LTV after void: ${custAfterVoid.lifetime_value} (expected: ${initialLtv})`);
      if (custAfterVoid.total_orders !== initialOrders || custAfterVoid.lifetime_value !== initialLtv) {
        throw new Error("Customer orders or lifetime value reversal failed!");
      }

      // Verify audit log exists
      const [audit] = await db
        .select()
        .from(audit_logs)
        .where(and(eq(audit_logs.store_id, 1), eq(audit_logs.action, "INVOICE_VOID")))
        .orderBy(desc(audit_logs.id))
        .limit(1);
      
      if (!audit) {
        throw new Error("Audit log entry for void was not written!");
      }
      console.log(`🛡️ Audit entry logged: "${audit.details}"`);

      console.log("\n🎉 ALL VOID SYSTEM INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n");
      process.exit(0);
    } catch (e: any) {
      console.error("❌ Test execution failed:", e);
      process.exit(1);
    }
  });
}

runTests();
