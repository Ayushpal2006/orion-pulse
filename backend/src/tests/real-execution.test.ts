import { db } from "../db";
import { suppliers, products, purchase_orders, purchase_items, supplier_ledger, inventory_movements } from "../db/schema";
import { storeStorage } from "../db/context";
import { purchaseV2Service } from "../services/purchase.v2.service";
import { eq, and } from "drizzle-orm";
import assert from "assert";

async function runRealExecutionTests() {
  console.log("=================================================");
  console.log("🔥 ORION POS — REAL EXECUTION TEST SUITE STARTED");
  console.log("=================================================\n");

  const storeId = 1;
  const ts = Date.now();

  // Ensure test supplier exists
  let [supplier] = await db.select().from(suppliers).where(eq(suppliers.store_id, storeId)).limit(1);
  if (!supplier) {
    [supplier] = await db
      .insert(suppliers)
      .values({
        store_id: storeId,
        supplier_code: `SUP-REAL-${ts}`,
        company_name: "Apex Electronics Supplies",
        current_balance: 0,
      })
      .returning();
  }

  // Ensure 2 test products exist
  let [product1] = await db.select().from(products).where(and(eq(products.store_id, storeId), eq(products.sku, "REAL-PROD-01"))).limit(1);
  if (!product1) {
    [product1] = await db
      .insert(products)
      .values({
        store_id: storeId,
        name: "Wireless Optical Mouse",
        sku: "REAL-PROD-01",
        purchase_price: 50000,
        selling_price: 99900,
        stock: 20,
        average_cost: 50000,
        last_purchase_cost: 50000,
      })
      .returning();
  }

  let [product2] = await db.select().from(products).where(and(eq(products.store_id, storeId), eq(products.sku, "REAL-PROD-02"))).limit(1);
  if (!product2) {
    [product2] = await db
      .insert(products)
      .values({
        store_id: storeId,
        name: "Mechanical Gaming Keyboard",
        sku: "REAL-PROD-02",
        purchase_price: 250000,
        selling_price: 399900,
        stock: 10,
        average_cost: 250000,
        last_purchase_cost: 250000,
      })
      .returning();
  }

  await storeStorage.run({ storeId, userId: 1, role: "Admin" }, async () => {
    const startStockP1 = product1.stock;

    // -------------------------------------------------------------
    // TEST 1: CREATE PURCHASE (Single Product)
    // -------------------------------------------------------------
    console.log("-------------------------------------------------");
    console.log("▶ TEST 1: Create Purchase (Single Product)");
    console.log("-------------------------------------------------");

    const po1Num = `PO-REAL-${ts}-01`;
    const po1Data = {
      supplier_id: supplier.id,
      po_number: po1Num,
      items: [
        {
          product_id: product1.id,
          quantity: 10,
          purchase_price: 600,
        },
      ],
      payment_status: "Pending",
      notes: "Real Execution Test 1",
    };

    const res1 = await purchaseV2Service.create(po1Data);
    console.log("API Response:", JSON.stringify(res1, null, 2));

    const po1Db = await db.select().from(purchase_orders).where(eq(purchase_orders.id, res1.id));
    const items1Db = await db.select().from(purchase_items).where(eq(purchase_items.purchase_order_id, res1.id));
    const prod1Db = await db.select().from(products).where(eq(products.id, product1.id));
    const mov1Db = await db.select().from(inventory_movements).where(and(eq(inventory_movements.reference_id, res1.po_number)));
    const supp1Db = await db.select().from(suppliers).where(eq(suppliers.id, supplier.id));
    const ledger1Db = await db.select().from(supplier_ledger).where(eq(supplier_ledger.reference, res1.po_number));

    console.log("\n📊 ACTUAL DATABASE ROWS INSERTED / UPDATED:");
    console.log("purchase_orders:", JSON.stringify(po1Db, null, 2));
    console.log("purchase_items:", JSON.stringify(items1Db, null, 2));
    console.log("updated product:", JSON.stringify(prod1Db, null, 2));
    console.log("inventory_movements:", JSON.stringify(mov1Db, null, 2));
    console.log("updated supplier balance:", supp1Db[0].current_balance);
    console.log("supplier_ledger:", JSON.stringify(ledger1Db, null, 2));

    assert.strictEqual(prod1Db[0].stock, startStockP1 + 10, "Stock must increase by 10");
    assert.strictEqual(prod1Db[0].selling_price, 99900, "Selling price must remain unchanged");

    // -------------------------------------------------------------
    // TEST 2: PURCHASE WITH 2 PRODUCTS
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 2: Purchase with 2 Products");
    console.log("-------------------------------------------------");

    const po2Data = {
      supplier_id: supplier.id,
      po_number: `PO-REAL-${ts}-02`,
      items: [
        { product_id: product1.id, quantity: 5, purchase_price: 600 },
        { product_id: product2.id, quantity: 4, purchase_price: 2600 },
      ],
      payment_status: "Pending",
    };

    const res2 = await purchaseV2Service.create(po2Data);
    const items2Db = await db.select().from(purchase_items).where(eq(purchase_items.purchase_order_id, res2.id));
    console.log("Inserted purchase_items rows count:", items2Db.length);
    assert.strictEqual(items2Db.length, 2, "Must insert 2 purchase_items rows");

    // -------------------------------------------------------------
    // TEST 3: PURCHASE WITH GST
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 3: Purchase with GST");
    console.log("-------------------------------------------------");

    const po3Data = {
      supplier_id: supplier.id,
      po_number: `PO-REAL-${ts}-03`,
      items: [{ product_id: product1.id, quantity: 2, purchase_price: 500 }],
      gst: 180,
      payment_status: "Paid",
    };

    const res3 = await purchaseV2Service.create(po3Data);
    const po3Db = await db.select().from(purchase_orders).where(eq(purchase_orders.id, res3.id));
    console.log("purchase_orders row for GST purchase:", JSON.stringify(po3Db, null, 2));
    assert.strictEqual(po3Db[0].gst, 18000, "GST column must equal 18000 Paise");

    // -------------------------------------------------------------
    // TEST 4: PURCHASE WITH DISCOUNT
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 4: Purchase with Discount");
    console.log("-------------------------------------------------");

    const po4Data = {
      supplier_id: supplier.id,
      po_number: `PO-REAL-${ts}-04`,
      items: [{ product_id: product1.id, quantity: 2, purchase_price: 500 }],
      discount: 50,
      payment_status: "Pending",
    };

    const res4 = await purchaseV2Service.create(po4Data);
    const po4Db = await db.select().from(purchase_orders).where(eq(purchase_orders.id, res4.id));
    console.log("purchase_orders row for Discount purchase:", JSON.stringify(po4Db, null, 2));
    assert.strictEqual(po4Db[0].discount, 5000, "Discount column must equal 5000 Paise");

    // -------------------------------------------------------------
    // TEST 5: INVALID SUPPLIER
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 5: Invalid Supplier Error Handling");
    console.log("-------------------------------------------------");

    let err5Caught = false;
    try {
      await purchaseV2Service.create({
        supplier_id: 999999,
        items: [{ product_id: product1.id, quantity: 1, purchase_price: 500 }],
      });
    } catch (e: any) {
      err5Caught = true;
      console.log("✅ Expected Exception Caught for Invalid Supplier:", e.message);
    }
    assert.strictEqual(err5Caught, true, "Must throw exception for invalid supplier");

    // -------------------------------------------------------------
    // TEST 6: INVALID PRODUCT
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 6: Invalid Product Error Handling");
    console.log("-------------------------------------------------");

    let err6Caught = false;
    try {
      await purchaseV2Service.create({
        supplier_id: supplier.id,
        items: [{ product_id: 999999, quantity: 1, purchase_price: 500 }],
      });
    } catch (e: any) {
      err6Caught = true;
      console.log("✅ Expected Exception Caught for Invalid Product:", e.message);
    }
    assert.strictEqual(err6Caught, true, "Must throw exception for invalid product");

    // -------------------------------------------------------------
    // TEST 7: INTENTIONAL TRANSACTION ROLLBACK
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 7: Intentional Transaction Rollback Verification");
    console.log("-------------------------------------------------");

    const preStock = (await db.select().from(products).where(eq(products.id, product1.id)))[0].stock;
    const prePoCount = (await db.select().from(purchase_orders)).length;
    const preLedgerCount = (await db.select().from(supplier_ledger)).length;

    let err7Caught = false;
    try {
      await purchaseV2Service.create({
        supplier_id: supplier.id,
        items: [
          { product_id: product1.id, quantity: 100, purchase_price: 500 },
          { product_id: 999999, quantity: 5, purchase_price: 1000 },
        ],
      });
    } catch (e: any) {
      err7Caught = true;
      console.log("✅ Intentional Error Triggered Transaction Rollback:", e.message);
    }

    assert.strictEqual(err7Caught, true, "Must trigger rollback on partial failure");

    const postStock = (await db.select().from(products).where(eq(products.id, product1.id)))[0].stock;
    const postPoCount = (await db.select().from(purchase_orders)).length;
    const postLedgerCount = (await db.select().from(supplier_ledger)).length;

    console.log("Pre-rollback stock:", preStock, "| Post-rollback stock:", postStock);
    console.log("Pre-rollback PO count:", prePoCount, "| Post-rollback PO count:", postPoCount);
    console.log("Pre-rollback Ledger count:", preLedgerCount, "| Post-rollback Ledger count:", postLedgerCount);

    assert.strictEqual(postStock, preStock, "Stock must NOT change on transaction rollback");
    assert.strictEqual(postPoCount, prePoCount, "PO count must NOT change on transaction rollback");
    assert.strictEqual(postLedgerCount, preLedgerCount, "Ledger count must NOT change on transaction rollback");

    console.log("\n=================================================");
    console.log("✨ ALL 7 REAL EXECUTION TESTS PASSED WITH 100% SUCCESS!");
    console.log("=================================================");
  });

  process.exit(0);
}

runRealExecutionTests().catch((err) => {
  console.error("❌ Real Execution Test Failed:", err);
  process.exit(1);
});
