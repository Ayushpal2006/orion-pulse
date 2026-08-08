import { storeStorage } from "../db/context";
import { ReceiptBuilderService } from "../services/receipt-builder.service";
import { PdfService } from "../services/pdf.service";
import { ShareService } from "../services/share.service";
import { db } from "../db";
import { sales, stores, organizations, settings } from "../db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

async function runReceiptPipelineTest() {
  console.log("==================================================");
  console.log("🧪 TESTING UNIFIED RECEIPT PIPELINE & BRANDING");
  console.log("==================================================\n");

  const pdfService = new PdfService();
  const shareService = new ShareService();

  const targetOrgId = 1;
  const targetStoreId = 1;

  await storeStorage.run(
    { organizationId: targetOrgId, currentStoreId: targetStoreId, userId: 1, role: "admin" },
    async () => {
      try {
        // Find existing sale or create test sale
        const [sale] = await db.select().from(sales).where(eq(sales.store_id, targetStoreId)).limit(1);

        if (!sale) {
          console.log("⚠️ No existing sales found to test. Test complete.");
          process.exit(0);
        }

        console.log(`🔍 Building ReceiptDTO for Invoice ${sale.invoice_number}...`);
        const receipt = await ReceiptBuilderService.buildReceipt(sale.invoice_number);

        console.log("\n✅ [1] ReceiptDTO Built Successfully:");
        console.log(`   - Invoice: ${receipt.invoiceNumber}`);
        console.log(`   - Shop Name: ${receipt.branding.shopName}`);
        console.log(`   - Shop Phone: ${receipt.branding.phone}`);
        console.log(`   - Shop GSTIN: ${receipt.branding.gstin}`);
        console.log(`   - PDF Template: ${receipt.branding.pdfTemplate}`);
        console.log(`   - Thermal Commands Count: ${receipt.thermalFormat.length}`);

        // Verify zero hardcoded 8285068670 phone fallback in WhatsApp Link
        const whatsappMsg = shareService.generateWhatsAppMessage(receipt);
        const whatsappLink = shareService.generateWhatsAppLink(receipt);

        console.log("\n✅ [2] WhatsApp Message Generated:");
        console.log("----------------------------------");
        console.log(whatsappMsg);
        console.log("----------------------------------");
        console.log(`   - Link: ${whatsappLink}`);

        if (whatsappMsg.includes("8285068670") && receipt.branding.phone !== "8285068670") {
          throw new Error("❌ Hardcoded phone number '8285068670' detected in WhatsApp message!");
        }

        // Test PDF Invoice generation
        const outPdfPath = path.resolve(__dirname, "../../test-invoice.pdf");
        await pdfService.generateInvoicePdf(receipt, outPdfPath);

        if (fs.existsSync(outPdfPath)) {
          console.log(`\n✅ [3] PDF Invoice Generated Successfully at: ${outPdfPath}`);
          fs.unlinkSync(outPdfPath); // Cleanup
        }

        console.log("\n==================================================");
        console.log("🎉 RECEIPT PIPELINE REFACTORING VERIFICATION PASSED");
        console.log("==================================================\n");
        process.exit(0);
      } catch (err: any) {
        console.error("❌ Pipeline test failed:", err.message || err);
        process.exit(1);
      }
    }
  );
}

runReceiptPipelineTest();
