import fs from "fs";
import path from "path";
import { settingsRepository } from "../repositories";

let PDFDocumentCache: any = null;
function getPDFDocument() {
  if (!PDFDocumentCache) {
    PDFDocumentCache = require("pdfkit");
  }
  return PDFDocumentCache;
}

export class PdfService {
  async generateInvoicePdf(receipt: any, outputPath: string): Promise<string> {
    const signature = await settingsRepository.get("signature", "Authorized Signatory");
    const exchangePolicy = await settingsRepository.get("exchange_policy", "Items can be exchanged within 7 days in original condition.");
    const theme = await settingsRepository.get("invoice_theme", "classic");
    const website = await settingsRepository.get("business_website", "https://apkabill.in");

    return new Promise((resolve, reject) => {
      try {
        const PDFDocument = getPDFDocument();
        const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
        doc.on("error", (err: any) => {
          reject(err);
        });

        const regularFontPath = path.join(__dirname, "../assets/fonts/Outfit-Regular.ttf");
        const boldFontPath = path.join(__dirname, "../assets/fonts/Outfit-Bold.ttf");

        const hasOutfit = fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath);
        if (hasOutfit) {
          doc.registerFont("Outfit", regularFontPath);
          doc.registerFont("Outfit-Bold", boldFontPath);
          doc.font("Outfit");
        } else {
          doc.registerFont("Outfit", "Helvetica");
          doc.registerFont("Outfit-Bold", "Helvetica-Bold");
          doc.font("Outfit");
        }

        const currencySymbol = hasOutfit ? "₹" : "Rs.";

        // Primary Theme color
        let primaryColor = "#0f172a"; // classic slate
        if (theme === "clean") primaryColor = "#2563eb"; // blue
        if (theme === "dark") primaryColor = "#1e293b"; // charcoal

        // Business Logo at top right if configured
        if (receipt.shop.logo && receipt.shop.logo.startsWith("data:image/")) {
          try {
            const base64Data = receipt.shop.logo.split(",")[1];
            if (base64Data) {
              const logoBuffer = Buffer.from(base64Data, "base64");
              doc.image(logoBuffer, 460, 40, { width: 95 });
            }
          } catch (e) {
            console.error("Failed to render logo in PDF invoice:", e);
          }
        }

        // Title Block
        doc.font("Outfit-Bold").fontSize(24).fillColor(primaryColor).text(receipt.shop.name, 40, 40, { width: 400 });
        doc.font("Outfit").fontSize(9).fillColor("#475569");
        doc.text(receipt.shop.address, { width: 400 });
        doc.text(`Phone: ${receipt.shop.phone} | Email: ${receipt.shop.email || "Support_Technician"} | GSTIN: ${receipt.shop.gstin}`, { width: 400 });
        
        doc.moveDown(2);
        
        // Divider
        doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1.5);

        // Metadata columns (Left: Customer, Right: Invoice meta)
        const metaY = doc.y;
        doc.font("Outfit-Bold").fontSize(10).fillColor(primaryColor).text("BILL TO:", 40, metaY);
        doc.font("Outfit").fillColor("#000000").text(receipt.customer.name, 40, metaY + 14);
        if (receipt.customer.phone) {
          doc.text(`Phone: +91 ${receipt.customer.phone}`, 40, metaY + 26);
        }

        doc.font("Outfit-Bold").fillColor(primaryColor).text("INVOICE DETAILS:", 350, metaY);
        doc.font("Outfit").fillColor("#000000").text(`Invoice Number: ${receipt.invoiceNumber}`, 350, metaY + 14);
        doc.text(`Date & Time: ${receipt.date} ${receipt.time}`, 350, metaY + 26);
        doc.text(`Cashier: ${receipt.cashier}`, 350, metaY + 38);
        if (receipt.status === "VOID") {
          doc.font("Outfit-Bold").fillColor("#ef4444").text("STATUS: VOID", 350, metaY + 50);
          doc.font("Outfit").fillColor("#ef4444").text(`Reason: ${receipt.voidReason || "N/A"}`, 350, metaY + 62);
          doc.text(`Voided By: ${receipt.voidedBy || "N/A"}`, 350, metaY + 74);
          doc.text(`Voided At: ${receipt.voidedAt ? new Date(receipt.voidedAt).toLocaleDateString("en-IN") + " " + new Date(receipt.voidedAt).toLocaleTimeString("en-IN") : "N/A"}`, 350, metaY + 86);
          doc.fillColor("#000000"); // Reset color
        }

        const detailsBottomY = receipt.status === "VOID" ? metaY + 105 : doc.y;
        doc.y = Math.max(doc.y, detailsBottomY);
        doc.moveDown(0.5);

        // Table Header
        const tableY = doc.y;
        doc.rect(40, tableY - 6, 515, 20).fill("#f1f5f9");
        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor);
        doc.text("Item Details", 45, tableY, { width: 180 });
        doc.text("Qty", 235, tableY, { width: 30, align: "right" });
        doc.text("Rate", 275, tableY, { width: 60, align: "right" });
        doc.text("Disc", 345, tableY, { width: 45, align: "right" });
        doc.text("GST", 400, tableY, { width: 45, align: "right" });
        doc.text("Total", 475, tableY, { width: 75, align: "right" });

        doc.moveDown(1);
        doc.font("Outfit").fontSize(9).fillColor("#000000");

        // Table rows
        for (const item of receipt.items) {
          const rowY = doc.y;
          // check page bounds
          if (rowY > 700) {
            doc.addPage();
            doc.y = 40;
          }

          doc.text(item.name, 45, rowY, { width: 180 });
          doc.text(String(item.qty), 235, rowY, { width: 30, align: "right" });
          doc.text(`${currencySymbol} ${item.price.toFixed(2)}`, 275, rowY, { width: 60, align: "right" });
          doc.text(`${item.discount}%`, 345, rowY, { width: 45, align: "right" });
          doc.text(`${item.gst}%`, 400, rowY, { width: 45, align: "right" });
          doc.text(`${currencySymbol} ${item.lineTotal.toFixed(2)}`, 475, rowY, { width: 75, align: "right" });
          doc.moveDown(0.9);
        }

        doc.moveDown(1);
        doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1.2);

        // Summary calculations block
        const totalsY = doc.y;
        doc.font("Outfit").fontSize(9).fillColor("#475569");
        doc.text("Subtotal:", 350, totalsY);
        doc.text(`${currencySymbol} ${receipt.subtotal.toFixed(2)}`, 475, totalsY, { align: "right", width: 75 });
        
        doc.text("Discount:", 350, totalsY + 14);
        doc.text(`${currencySymbol} ${receipt.discount.toFixed(2)}`, 475, totalsY + 14, { align: "right", width: 75 });

        doc.text("GST Tax:", 350, totalsY + 28);
        doc.text(`${currencySymbol} ${receipt.gst.toFixed(2)}`, 475, totalsY + 28, { align: "right", width: 75 });

        doc.rect(350, totalsY + 42, 205, 1).fill(primaryColor);

        doc.font("Outfit-Bold").fontSize(11).fillColor(primaryColor).text("Grand Total:", 350, totalsY + 48);
        doc.text(`${currencySymbol} ${receipt.grandTotal.toFixed(2)}`, 475, totalsY + 48, { align: "right", width: 75 });

        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text("PAYMENT DETAILS", 40, totalsY);
        doc.font("Outfit").fillColor("#000000").text(`Method: ${receipt.paymentMethod}`, 40, totalsY + 14);
        doc.text(`Status: ${receipt.status === "VOID" ? "VOID (Cancelled)" : "Paid"}`, 40, totalsY + 26);
        if (receipt.paymentMethod === "UPI") {
          doc.text(`UPI ID: ${receipt.shop.upiId}`, 40, totalsY + 38, { width: 170 });
          
          // Draw high resolution vector QR code next to payment details (x=220)
          if (receipt.upiQrCode) {
            try {
              const base64Data = receipt.upiQrCode.split(",")[1];
              if (base64Data) {
                const qrBuffer = Buffer.from(base64Data, "base64");
                doc.image(qrBuffer, 230, totalsY, { width: 75 });
              }
            } catch (e) {
              console.error("Failed to render QR code in PDF:", e);
            }
          }
        }

        // Terms and Signature block
        doc.moveDown(5);
        const policyY = doc.y > 620 ? 620 : doc.y;
        
        doc.font("Outfit-Bold").fontSize(8).fillColor(primaryColor).text("EXCHANGE POLICY:", 40, policyY);
        doc.font("Outfit").fillColor("#475569").text(exchangePolicy, 40, policyY + 12, { width: 250 });
        doc.text(`Visit website: ${website}`, 40, policyY + 40);

        doc.font("Outfit-Bold").fillColor(primaryColor).text("FOR APKA BILL", 380, policyY, { align: "center", width: 175 });
        doc.font("Outfit").fontSize(8).fillColor("#64748b").text(signature, 380, policyY + 35, { align: "center", width: 175 });
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(380, policyY + 32).lineTo(555, policyY + 32).stroke();

        // Footer note
        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text(receipt.thankYouMessage, 40, 750, { align: "center", width: 515 });
        doc.font("Outfit").fontSize(7).fillColor("#94a3b8").text("Generated automatically via Apka Bill sharing ecosystem.", 40, 762, { align: "center", width: 515 });

        // Add dynamic footer page numbers for all pages
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          
          // Draw VOID watermark diagonally behind text
          if (receipt.status === "VOID") {
            doc.save();
            doc.fontSize(100).font("Outfit-Bold").fillColor("#ef4444").opacity(0.08);
            doc.rotate(-30, { origin: [300, 420] });
            doc.text("VOID", 150, 400, { width: 300, align: "center" });
            doc.restore();
          }

          doc.fontSize(8).font("Outfit").fillColor("#94a3b8");
          doc.text(`Page ${i + 1} of ${range.count}`, 40, 800, { align: "center", width: 515 });
        }

        doc.end();

        stream.on("finish", () => {
          resolve(outputPath);
        });
        stream.on("error", (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
