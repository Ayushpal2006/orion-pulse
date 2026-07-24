import { db } from "../db";
import { initDb } from "../database/init";
import { products, purchase_orders, purchase_items, suppliers, supplier_ledger, inventory_movements } from "../db/schema";
import { storeStorage } from "../db/context";
import { PurchaseV2Service } from "../services/purchase.v2.service";
import { PdfService } from "../services/pdf.service";
import { ShareService } from "../services/share.service";
import { eq } from "drizzle-orm";
import assert from "assert";
import path from "path";
import fs from "fs";

async function runPurchaseManagementE2ETest() {
  console.log("=================================================");
  console.log("📦 ORION POS — PURCHASE MODULE MASTER E2E TEST");
  console.log("=================================================\n");

  await initDb();

  const storeId = 1;
  const purchaseService = new PurchaseV2Service();
  const pdfService = new PdfService();
  const shareService = new ShareService();

  await storeStorage.run({ storeId, userId: 1, role: "Admin" }, async () => {
    // 1. Setup / Fetch active supplier and product
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.store_id, storeId)).limit(1);
    assert.ok(supplier, "Supplier must exist for test");
    const [product] = await db.select().from(products).where(eq(products.id, 1));
    assert.ok(product, "Product 1 must exist for test");

    const initialStock = product.stock;
    const initialSupplierBalance = supplier.current_balance;

    console.log("▶ Initial State:", {
      supplierId: supplier.id,
      supplierName: supplier.company_name,
      initialBalance: initialSupplierBalance / 100,
      productId: product.id,
      productName: product.name,
      initialStock,
    });

    // 2. Create Purchase Order
    console.log("\n▶ Step 1: Creating Purchase Order...");
    const createPayload = {
      supplier_id: supplier.id,
      supplier_invoice_number: "INV-E2E-9999",
      invoice_number: "INV-E2E-9999",
      purchase_date: new Date().toISOString(),
      payment_status: "Paid",
      payment_method: "Bank Transfer",
      notes: "E2E Automated Test Purchase",
      discount: 0,
      gst: 0,
      items: [
        {
          product_id: product.id,
          quantity: 10,
          purchase_price: 450, // ₹450
        },
      ],
    };

    const createdPo = await purchaseService.create(createPayload);
    console.log(`✅ Purchase Created: PO #${createdPo.po_number}, Supplier Inv: ${createdPo.supplier_invoice_number}, Total: ₹${createdPo.grand_total / 100}`);

    // Verify Stock increased by 10
    const [postCreateProduct] = await db.select().from(products).where(eq(products.id, 1));
    assert.strictEqual(postCreateProduct.stock, initialStock + 10, "Product stock must increase by 10 after purchase creation");

    // Verify Supplier balance increased
    const [postCreateSupplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplier.id));
    assert.strictEqual(postCreateSupplier.current_balance, initialSupplierBalance + createdPo.grand_total, "Supplier balance must increase by PO grand total");

    // 3. Edit Purchase Order (increase qty to 15)
    console.log("\n▶ Step 2: Editing Purchase Order (increasing qty to 15)...");
    const editPayload = {
      ...createPayload,
      items: [
        {
          product_id: product.id,
          quantity: 15,
          purchase_price: 450,
        },
      ],
    };

    const updatedPo = await purchaseService.update(createdPo.id, editPayload);
    console.log(`✅ Purchase Updated: PO #${updatedPo.po_number}, New Total: ₹${updatedPo.grand_total / 100}`);

    const [postEditProduct] = await db.select().from(products).where(eq(products.id, 1));
    assert.strictEqual(postEditProduct.stock, initialStock + 15, "Product stock must adjust to +15 after PO edit");

    // 4. Test PDF Generation
    console.log("\n▶ Step 3: Generating Purchase Order PDF...");
    const testPdfPath = path.join(process.cwd(), `test_po_${createdPo.po_number}.pdf`);
    const fullPoData = await purchaseService.getById(createdPo.id);
    await pdfService.generatePurchasePdf(fullPoData, testPdfPath);
    assert.ok(fs.existsSync(testPdfPath), "Purchase PDF file must be created on disk");
    fs.unlinkSync(testPdfPath);
    console.log("✅ PDF Generated successfully.");

    // 5. Test WhatsApp Link Generation
    console.log("\n▶ Step 4: Generating WhatsApp share link...");
    const waLink = shareService.generateSupplierWhatsAppLink(fullPoData);
    assert.ok(waLink.includes("https://wa.me/"), "WhatsApp link must be valid format");
    console.log("✅ WhatsApp link generated:", waLink);

    // 6. Test Void Purchase Order
    console.log("\n▶ Step 5: Voiding Purchase Order...");
    await purchaseService.voidPurchase(createdPo.id, "E2E Void Testing", "Admin");
    console.log("✅ Purchase Order Voided.");

    const [postVoidProduct] = await db.select().from(products).where(eq(products.id, 1));
    assert.strictEqual(postVoidProduct.stock, initialStock, "Product stock must be restored to initial level after void");

    const [postVoidSupplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplier.id));
    assert.strictEqual(postVoidSupplier.current_balance, initialSupplierBalance, "Supplier balance must revert to initial level after void");

    const [voidedPoRecord] = await db.select().from(purchase_orders).where(eq(purchase_orders.id, createdPo.id));
    assert.strictEqual(voidedPoRecord.status, "VOID", "PO status must be VOID");
    assert.strictEqual(voidedPoRecord.void_reason, "E2E Void Testing", "Void reason must match");

    // 7. Test Soft Delete Purchase Order
    console.log("\n▶ Step 6: Soft deleting a Purchase Order...");
    const createForDelete = await purchaseService.create({
      ...createPayload,
      items: [{ product_id: product.id, quantity: 5, purchase_price: 300 }],
    });

    await purchaseService.delete(createForDelete.id, "Admin");
    const [deletedPoRecord] = await db.select().from(purchase_orders).where(eq(purchase_orders.id, createForDelete.id));
    assert.strictEqual(deletedPoRecord.status, "DELETED", "PO status must be DELETED");
    console.log("✅ Purchase Order Soft Deleted.");

    console.log("\n=================================================");
    console.log("✨ ALL PURCHASE MASTER E2E TESTS PASSED 100%!");
    console.log("=================================================");
  });

  process.exit(0);
}

runPurchaseManagementE2ETest().catch((err) => {
  console.error("❌ Purchase E2E Test Failed:", err);
  process.exit(1);
});
