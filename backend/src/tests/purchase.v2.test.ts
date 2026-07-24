import { db } from "../db";
import { suppliers, products, purchase_orders, purchase_items, supplier_ledger, inventory_movements, inventory_logs, product_cost_history } from "../db/schema";
import { storeStorage } from "../db/context";
import { purchaseV2Service } from "../services/purchase.v2.service";
import { eq, and } from "drizzle-orm";
import assert from "assert";

async function runV2Tests() {
  console.log("🚀 Starting Purchase V2 Verification Test Suite...");

  // 1. Setup Test Store Context & Test Data
  const storeId = 1;

  // Clean test artifacts if existing
  let [supplier] = await db.select().from(suppliers).where(eq(suppliers.store_id, storeId)).limit(1);
  if (!supplier) {
    [supplier] = await db
      .insert(suppliers)
      .values({
        store_id: storeId,
        supplier_code: "SUP-TEST-V2",
        company_name: "V2 Test Supplier",
        current_balance: 0,
      })
      .returning();
  }

  const initialSupplierBalance = supplier.current_balance;

  // Create clean isolated test product
  const [product] = await db
    .insert(products)
    .values({
      store_id: storeId,
      name: "V2 Test Item Widget",
      sku: `SKU-V2-${Date.now()}`,
      purchase_price: 8000, // 80 INR
      selling_price: 15000, // 150 INR (Must NOT be modified by purchase)
      stock: 10,
      average_cost: 8000, // 80 INR
      last_purchase_cost: 8000,
    })
    .returning();

  console.log("✅ Initial Product State:", {
    id: product.id,
    stock: product.stock,
    average_cost: product.average_cost,
    selling_price: product.selling_price,
  });

  const purchaseService = purchaseV2Service;

  await storeStorage.run({ storeId, userId: 1, role: "Admin" }, async () => {
    // -------------------------------------------------------------
    // TEST 1: CREATE PURCHASE
    // -------------------------------------------------------------
    console.log("\n🧪 Test 1: Executing Purchase Creation...");
    const createPayload = {
      supplier_id: supplier.id,
      po_number: `TEST-PO-V2-${Date.now()}`,
      items: [
        {
          product_id: product.id,
          quantity: 5,
          purchase_price: 110, // 110 INR = 11000 Paise
        },
      ],
      discount: 0,
      gst: 0,
      payment_status: "Pending",
      notes: "V2 Verification Purchase Entry",
    };

    const createdPo = await purchaseService.create(createPayload);
    assert.ok(createdPo.id, "Purchase Order ID must be returned");
    console.log("✅ Purchase Created ID:", createdPo.id, "PO Number:", createdPo.po_number);

    // Verify Product Stock & Costing Updates
    const [updatedProduct] = await db.select().from(products).where(eq(products.id, product.id));
    console.log("📊 Product Post-Purchase State:", {
      stock: updatedProduct.stock,
      average_cost: updatedProduct.average_cost,
      selling_price: updatedProduct.selling_price,
    });

    // Stock Assertion: 10 + 5 = 15
    assert.strictEqual(updatedProduct.stock, 15, "Stock must increase from 10 to 15");

    // Weighted Average Cost Assertion: ((10 * 8000) + (5 * 11000)) / 15 = 135000 / 15 = 9000 Paise (90 INR)
    assert.strictEqual(updatedProduct.average_cost, 9000, "Weighted average cost must equal 9000 Paise (90 INR)");

    // Selling Price Protection Assertion: Must remain 15000
    assert.strictEqual(updatedProduct.selling_price, 15000, "Selling price must remain unchanged (15000 Paise)");

    // Verify Inventory Movements Audit Record
    const movements = await db
      .select()
      .from(inventory_movements)
      .where(and(eq(inventory_movements.product_id, product.id), eq(inventory_movements.movement_type, "PURCHASE")));
    assert.ok(movements.length > 0, "Inventory movement audit log must be recorded");
    assert.strictEqual(movements[movements.length - 1].new_stock, 15, "Movement new stock must be 15");

    // Verify Inventory Logs (Legacy Audit Record)
    const logs = await db
      .select()
      .from(inventory_logs)
      .where(and(eq(inventory_logs.product_id, product.id), eq(inventory_logs.type, "PURCHASE")));
    assert.ok(logs.length > 0, "Inventory log audit record must be recorded");

    // Verify Product Cost History Log
    const costHistories = await db
      .select()
      .from(product_cost_history)
      .where(eq(product_cost_history.product_id, product.id));
    assert.ok(costHistories.length > 0, "Cost history record must be recorded");
    assert.strictEqual(costHistories[costHistories.length - 1].average_cost, 9000, "Cost history average cost must be 9000");

    // Verify Supplier Balance & Ledger Updates
    const [updatedSupplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplier.id));
    const expectedGrandTotalPaise = 5 * 11000; // 55000 Paise (550 INR)
    const expectedBalance = initialSupplierBalance + expectedGrandTotalPaise;
    assert.strictEqual(updatedSupplier.current_balance, expectedBalance, `Supplier balance must increase by ${expectedGrandTotalPaise} Paise`);

    const ledgers = await db
      .select()
      .from(supplier_ledger)
      .where(and(eq(supplier_ledger.supplier_id, supplier.id), eq(supplier_ledger.reference, createdPo.po_number)));
    assert.strictEqual(ledgers.length, 1, "Supplier ledger entry must be recorded");
    assert.strictEqual(ledgers[0].amount, expectedGrandTotalPaise, "Supplier ledger amount must match PO grand total");

    // -------------------------------------------------------------
    // TEST 2: GET BY ID & GET ALL
    // -------------------------------------------------------------
    console.log("\n🧪 Test 2: Verifying Get APIs...");
    const fetchedPo = await purchaseService.getById(createdPo.id);
    assert.ok(fetchedPo, "Purchase Order must be retrieved by ID");
    assert.ok(Array.isArray(fetchedPo.items), "Fetched PO must contain items array");
    assert.strictEqual(fetchedPo.items.length, 1, "Fetched PO items length must equal 1");

    const allPurchases = await purchaseService.getAll({ q: createdPo.po_number });
    assert.ok(allPurchases.length > 0, "getAll must find created PO");

    // -------------------------------------------------------------
    // TEST 3: DELETE PURCHASE (STOCK & BALANCE REVERSAL)
    // -------------------------------------------------------------
    console.log("\n🧪 Test 3: Executing Purchase Deletion & Reversal...");
    const deleteSuccess = await purchaseService.delete(createdPo.id);
    assert.strictEqual(deleteSuccess, true, "Purchase deletion must return true");

    // Verify Stock Reverted: 15 - 5 = 10
    const [revertedProduct] = await db.select().from(products).where(eq(products.id, product.id));
    assert.strictEqual(revertedProduct.stock, 10, "Stock must be reverted to 10 upon deletion");

    // Verify Supplier Balance Reverted
    const [revertedSupplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplier.id));
    assert.strictEqual(revertedSupplier.current_balance, initialSupplierBalance, "Supplier balance must revert to initial balance");

    // Verify Cancel Movement Logged
    const cancelMovements = await db
      .select()
      .from(inventory_movements)
      .where(and(eq(inventory_movements.product_id, product.id), eq(inventory_movements.movement_type, "PURCHASE_CANCEL")));
    assert.ok(cancelMovements.length > 0, "Inventory movement PURCHASE_CANCEL audit log must be recorded");

    console.log("\n✨ ALL PURCHASE V2 VERIFICATION TESTS PASSED 100% CLEANLY!");
  });

  process.exit(0);
}

runV2Tests().catch((err) => {
  console.error("❌ Purchase V2 Test Failed:", err);
  process.exit(1);
});
