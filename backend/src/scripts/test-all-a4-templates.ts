import path from "path";
import fs from "fs";
import { PdfService } from "../services/pdf.service";

async function runTestAllTemplates() {
  console.log("🚀 Testing All A4 PDF Invoice Templates...");

  const pdfService = new PdfService();

  const templates = ["Professional A4", "Standard A4", "GST Invoice A4"];

  for (const tpl of templates) {
    const mockReceipt = {
      invoiceNumber: `INV-${tpl.replace(/\s+/g, "-")}-001`,
      date: "07/08/2026",
      time: "01:30 PM",
      pdfTemplate: tpl,
      signature: "Authorized Signatory",
      shop: {
        storeId: 1,
        organizationId: 1,
        name: "Acme Supermart",
        gstin: "27AAACB1234C1Z5",
        phone: "+91 9876543210",
        address: "123 Business Park, Main Road, Pune 411001",
        email: "contact@acmesupermart.com",
        upiId: "acme@upi",
      },
      customer: {
        name: "Vikram Mehta",
        phone: "9820011223",
        address: "Suite 501, Horizon Towers, Baner, Pune",
        gstin: "27BCCCD9999E1Z2",
      },
      items: [
        { name: "Premium Basmati Rice 5kg", qty: 2, price: 450, discount: 20, lineTotal: 880, gst: 5 },
        { name: "Organic Cold Pressed Coconut Oil 1L", qty: 1, price: 380, discount: 0, lineTotal: 380, gst: 12 },
      ],
      subtotal: 1280,
      discount: 20,
      gst: 81.4,
      grandTotal: 1341.4,
      paymentMethod: "UPI",
      cashier: "Rohan Patel",
      thankYouMessage: "Thank you for shopping with Acme Supermart!",
      termsAndConditions: "Goods once sold cannot be returned without invoice.",
      status: "PAID",
      upiPayload: "upi://pay?pa=acme@upi&pn=Acme%20Supermart&am=1341.40&cu=INR",
    };

    const outputFolder = path.join(__dirname, "../../scratch");
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const outputPath = path.join(outputFolder, `${mockReceipt.invoiceNumber}.pdf`);
    const resultPath = await pdfService.generateInvoicePdf(mockReceipt, outputPath);
    const stats = fs.statSync(resultPath);
    console.log(`✅ ${tpl} generated: ${resultPath} (${stats.size} bytes)`);
  }
}

runTestAllTemplates();
