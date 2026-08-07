import path from "path";
import fs from "fs";
import { PdfService } from "../services/pdf.service";

async function runTest() {
  console.log("🚀 Testing A4 PDF Invoice Generator...");

  const pdfService = new PdfService();

  const mockReceipt = {
    invoiceNumber: "INV-TEST-2026-001",
    date: "07/08/2026",
    time: "01:30 PM",
    template: "Classic",
    pdfTemplate: "Professional A4",
    signature: "Authorized Store Signatory",
    shop: {
      storeId: 1,
      organizationId: 1,
      name: "SuperMart Retail Store",
      gstin: "27AAACB1234C1Z5",
      phone: "+91 9876543210",
      address: "Plot 42, Commercial Complex, Sector 18, Cyber City, Gurgaon, 122002",
      email: "contact@supermartretail.com",
      upiId: "supermart@upi",
      logo: "",
    },
    customer: {
      name: "Rajesh Kumar",
      phone: "9811223344",
      address: "Flat 402, Sunshine Apartments, DLF Phase 4, Gurgaon",
      gstin: "07AAAAA0000A1Z5",
    },
    items: [
      { name: "Organic Basmati Rice 5kg Premium Pack", qty: 2, price: 550, discount: 50, lineTotal: 1050, gst: 5 },
      { name: "Cold-Pressed Sunflower Oil 2L", qty: 3, price: 340, discount: 20, lineTotal: 1000, gst: 12 },
      { name: "Whole Wheat Atta 10kg Special Blend", qty: 1, price: 480, discount: 0, lineTotal: 480, gst: 0 },
      { name: "Almonds Raw 500g Glass Jar", qty: 4, price: 450, discount: 100, lineTotal: 1700, gst: 12 },
      { name: "Dark Chocolate 85% Cacao 100g Bar", qty: 5, price: 180, discount: 0, lineTotal: 900, gst: 18 },
    ],
    subtotal: 5130,
    discount: 170,
    gst: 483.4,
    grandTotal: 5443.4,
    paymentMethod: "UPI",
    cashier: "Anita Sharma",
    thankYouMessage: "Thank you for shopping with SuperMart! Goods once sold can be exchanged within 7 days.",
    termsAndConditions: "1. All disputes subject to local jurisdiction.\n2. Invoice required for all exchanges.",
    status: "PAID",
    upiQrCode: "",
  };

  const outputFolder = path.join(__dirname, "../../scratch");
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const outputPath = path.join(outputFolder, `${mockReceipt.invoiceNumber}.pdf`);

  try {
    const resultPath = await pdfService.generateInvoicePdf(mockReceipt, outputPath);
    console.log(`✅ A4 PDF Invoice generated successfully at: ${resultPath}`);
    const stats = fs.statSync(resultPath);
    console.log(`📊 Generated File Size: ${stats.size} bytes`);
  } catch (err) {
    console.error("❌ Failed to generate A4 PDF Invoice:", err);
  }
}

runTest();
