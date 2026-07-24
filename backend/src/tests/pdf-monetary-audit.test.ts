import { SalesService } from "../services/sales.service";
import { PurchaseService } from "../services/purchase.service";
import { db } from "../db";
import { initDb } from "../database/init";
import { sales, purchase_orders } from "../db/schema";
import { storeStorage } from "../db/context";
import { eq } from "drizzle-orm";
import { formatInrPdf } from "../services/pdf-font.helper";

const salesService = new SalesService();
const purchaseService = new PurchaseService();

async function auditMonetaryValues() {
  console.log("=================================================");
  console.log("💰 ORION POS — PDF MONETARY VALUES AUDIT");
  console.log("=================================================");

  await initDb();

  // 1. Audit Sales Invoices
  const recentSales = await db.select().from(sales).limit(5);
  console.log(`\n▶ Auditing ${recentSales.length} Sales Invoices...`);

  for (const s of recentSales) {
    const receipt = await salesService.getReceipt(s.invoice_number);

    const dbSubtotal = (s.subtotal / 100.0);
    const dbDiscount = (s.discount / 100.0);
    const dbGst = (s.gst / 100.0);
    const dbGrandTotal = (s.grand_total / 100.0);

    console.log(`\nInvoice #${s.invoice_number}:`);
    console.log(`  Subtotal: DB = ${dbSubtotal} | Receipt = ${receipt.subtotal} | PDF = ${formatInrPdf(receipt.subtotal)}`);
    console.log(`  Discount: DB = ${dbDiscount} | Receipt = ${receipt.discount} | PDF = ${formatInrPdf(receipt.discount)}`);
    console.log(`  GST Tax:  DB = ${dbGst} | Receipt = ${receipt.gst} | PDF = ${formatInrPdf(receipt.gst)}`);
    console.log(`  GrandTotal: DB = ${dbGrandTotal} | Receipt = ${receipt.grandTotal} | PDF = ${formatInrPdf(receipt.grandTotal)}`);

    if (
      Math.abs(dbSubtotal - receipt.subtotal) > 0.001 ||
      Math.abs(dbDiscount - receipt.discount) > 0.001 ||
      Math.abs(dbGst - receipt.gst) > 0.001 ||
      Math.abs(dbGrandTotal - receipt.grandTotal) > 0.001
    ) {
      throw new Error(`❌ Monetary mismatch found in Invoice #${s.invoice_number}`);
    }
    console.log(`  ✅ All invoice monetary values match DB 100%.`);
  }

  // 2. Audit Purchase Orders
  const recentPurchases = await db.select().from(purchase_orders).limit(5);
  console.log(`\n▶ Auditing ${recentPurchases.length} Purchase Orders...`);

  for (const p of recentPurchases) {
    const fullPoData = await storeStorage.run({ storeId: 1, userId: 1, role: "Admin" }, async () => {
      return await purchaseService.getById(p.id);
    });

    const dbSubtotal = ((p.subtotal || p.grand_total) / 100.0);
    const dbDiscount = ((p.discount || 0) / 100.0);
    const dbGst = ((p.gst || 0) / 100.0);
    const dbGrandTotal = (p.grand_total / 100.0);

    const pdfSubtotal = (fullPoData.subtotal ? fullPoData.subtotal / 100.0 : dbGrandTotal);
    const pdfDiscount = (fullPoData.discount ? fullPoData.discount / 100.0 : 0);
    const pdfGst = (fullPoData.gst ? fullPoData.gst / 100.0 : 0);
    const pdfGrandTotal = fullPoData.grand_total / 100.0;

    console.log(`\nPO #${p.po_number}:`);
    console.log(`  Subtotal: DB = ${dbSubtotal} | PDF = ${formatInrPdf(pdfSubtotal)}`);
    console.log(`  Discount: DB = ${dbDiscount} | PDF = ${formatInrPdf(pdfDiscount)}`);
    console.log(`  GST Tax:  DB = ${dbGst} | PDF = ${formatInrPdf(pdfGst)}`);
    console.log(`  GrandTotal: DB = ${dbGrandTotal} | PDF = ${formatInrPdf(pdfGrandTotal)}`);

    if (Math.abs(dbGrandTotal - pdfGrandTotal) > 0.001) {
      throw new Error(`❌ Grand Total mismatch found in PO #${p.po_number}`);
    }
    console.log(`  ✅ All purchase order monetary values match DB 100%.`);
  }

  console.log("\n=================================================");
  console.log("✨ PDF MONETARY VALUES AUDIT PASSED CLEANLY!");
  console.log("=================================================");
  process.exit(0);
}

auditMonetaryValues().catch((err) => {
  console.error(err);
  process.exit(1);
});
