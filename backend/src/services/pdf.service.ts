import fs from "fs";
import path from "path";
import { settingsRepository } from "../repositories";
import { configurePdfFonts, formatInrPdf } from "./pdf-font.helper";

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

        configurePdfFonts(doc);

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
        
        doc.moveDown(1.5);
        
        // Divider
        doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1);

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

        // Helper function to draw table header
        const drawTableHeader = () => {
          const tableY = doc.y;
          doc.rect(40, tableY - 4, 515, 18).fill("#f1f5f9");
          doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor);
          doc.text("Item Details", 45, tableY, { width: 180 });
          doc.text("Qty", 235, tableY, { width: 30, align: "right" });
          doc.text("Rate", 275, tableY, { width: 60, align: "right" });
          doc.text("Disc", 345, tableY, { width: 45, align: "right" });
          doc.text("GST", 400, tableY, { width: 45, align: "right" });
          doc.text("Total", 475, tableY, { width: 75, align: "right" });
          doc.moveDown(0.8);
          doc.font("Outfit").fontSize(9).fillColor("#000000");
        };

        drawTableHeader();

        // Table rows
        for (const item of receipt.items) {
          if (doc.y > 640) {
            doc.addPage();
            doc.y = 40;
            drawTableHeader();
          }

          const rowY = doc.y;
          doc.text(item.name, 45, rowY, { width: 180 });
          doc.text(String(item.qty), 235, rowY, { width: 30, align: "right" });
          doc.text(formatInrPdf(item.price), 275, rowY, { width: 60, align: "right" });
          doc.text(`${item.discount}%`, 345, rowY, { width: 45, align: "right" });
          doc.text(`${item.gst}%`, 400, rowY, { width: 45, align: "right" });
          doc.text(formatInrPdf(item.lineTotal), 475, rowY, { width: 75, align: "right" });
          doc.moveDown(0.8);
        }

        doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.8);

        // Summary calculations block (Add page if not enough space)
        if (doc.y > 600) {
          doc.addPage();
          doc.y = 40;
        }

        const totalsY = doc.y;
        doc.font("Outfit").fontSize(9).fillColor("#475569");
        doc.text("Subtotal:", 350, totalsY);
        doc.text(formatInrPdf(receipt.subtotal), 475, totalsY, { align: "right", width: 75 });
        
        doc.text("Discount:", 350, totalsY + 14);
        doc.text(formatInrPdf(receipt.discount), 475, totalsY + 14, { align: "right", width: 75 });

        doc.text("GST Tax:", 350, totalsY + 28);
        doc.text(formatInrPdf(receipt.gst), 475, totalsY + 28, { align: "right", width: 75 });

        doc.rect(350, totalsY + 42, 205, 1).fill(primaryColor);

        doc.font("Outfit-Bold").fontSize(11).fillColor(primaryColor).text("Grand Total:", 350, totalsY + 48);
        doc.text(formatInrPdf(receipt.grandTotal), 475, totalsY + 48, { align: "right", width: 75 });

        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text("PAYMENT DETAILS", 40, totalsY);
        doc.font("Outfit").fillColor("#000000").text(`Method: ${receipt.paymentMethod}`, 40, totalsY + 14);
        doc.text(`Status: ${receipt.status === "VOID" ? "VOID (Cancelled)" : "Paid"}`, 40, totalsY + 26);
        if (receipt.paymentMethod === "UPI") {
          doc.text(`UPI ID: ${receipt.shop.upiId}`, 40, totalsY + 38, { width: 170 });
          
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
        const policyY = Math.max(doc.y + 20, totalsY + 80);
        if (policyY > 670) {
          doc.addPage();
          doc.y = 40;
        }

        const finalPolicyY = doc.y;
        doc.font("Outfit-Bold").fontSize(8).fillColor(primaryColor).text("EXCHANGE POLICY:", 40, finalPolicyY);
        doc.font("Outfit").fillColor("#475569").text(exchangePolicy, 40, finalPolicyY + 12, { width: 250 });
        doc.text(`Visit website: ${website}`, 40, finalPolicyY + 40);

        doc.font("Outfit-Bold").fillColor(primaryColor).text("FOR APKA BILL", 380, finalPolicyY, { align: "center", width: 175 });
        doc.font("Outfit").fontSize(8).fillColor("#64748b").text(signature, 380, finalPolicyY + 35, { align: "center", width: 175 });
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(380, finalPolicyY + 32).lineTo(555, finalPolicyY + 32).stroke();

        // Footer note
        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text(receipt.thankYouMessage, 40, 735, { align: "center", width: 515, lineBreak: false });
        doc.font("Outfit").fontSize(7).fillColor("#94a3b8").text("Generated automatically via Apka Bill sharing ecosystem.", 40, 748, { align: "center", width: 515, lineBreak: false });

        // Add dynamic footer page numbers for all pages without causing page overflow
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          
          if (receipt.status === "VOID") {
            doc.save();
            doc.fontSize(100).font("Outfit-Bold").fillColor("#ef4444").opacity(0.08);
            doc.rotate(-30, { origin: [300, 420] });
            doc.text("VOID", 150, 400, { width: 300, align: "center", lineBreak: false });
            doc.restore();
          }

          doc.fontSize(8).font("Outfit").fillColor("#94a3b8");
          doc.text(`Page ${i + 1} of ${range.count}`, 40, 770, { align: "center", width: 515, lineBreak: false });
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

  async generatePurchasePdf(purchase: any, outputPath: string): Promise<string> {
    const signature = await settingsRepository.get("signature", "Authorized Signatory");

    return new Promise((resolve, reject) => {
      try {
        const PDFDocument = getPDFDocument();
        const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
        doc.on("error", (err: any) => reject(err));

        configurePdfFonts(doc);
        const primaryColor = "#0f172a";

        // Title Block
        doc.font("Outfit-Bold").fontSize(22).fillColor(primaryColor).text(purchase.shop?.name || "ORION POS STORE", 40, 40, { width: 400 });
        doc.font("Outfit").fontSize(9).fillColor("#475569");
        if (purchase.shop?.address) doc.text(purchase.shop.address, { width: 400 });
        doc.text(`Phone: ${purchase.shop?.phone || "-"} | GSTIN: ${purchase.shop?.gstin || "-"}`, { width: 400 });

        doc.moveDown(1.5);
        doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1.5);

        // Metadata
        const metaY = doc.y;
        doc.font("Outfit-Bold").fontSize(10).fillColor(primaryColor).text("SUPPLIER DETAILS:", 40, metaY);
        doc.font("Outfit").fillColor("#000000").text(purchase.supplier_name || "N/A", 40, metaY + 14);
        if (purchase.supplier_phone) doc.text(`Phone: ${purchase.supplier_phone}`, 40, metaY + 26);
        if (purchase.supplier_gstin) doc.text(`GSTIN: ${purchase.supplier_gstin}`, 40, metaY + 38);

        doc.font("Outfit-Bold").fillColor(primaryColor).text("PURCHASE ORDER DETAILS:", 330, metaY);
        doc.font("Outfit").fillColor("#000000").text(`PO Number: ${purchase.po_number}`, 330, metaY + 14);
        doc.text(`Supplier Invoice #: ${purchase.invoice_number || purchase.supplier_invoice_number || "N/A"}`, 330, metaY + 26);
        doc.text(`Date: ${new Date(purchase.purchase_date || purchase.created_at).toLocaleDateString("en-IN")}`, 330, metaY + 38);
        doc.text(`Payment Status: ${purchase.payment_status || "Paid"} (${purchase.payment_method || "Cash"})`, 330, metaY + 50);

        if (purchase.status === "VOID" || purchase.status === "DELETED") {
          doc.font("Outfit-Bold").fillColor("#ef4444").text(`STATUS: ${purchase.status}`, 330, metaY + 62);
        }

        doc.y = metaY + 80;
        doc.moveDown(1);

        const drawTableHeader = () => {
          const tableTop = doc.y;
          doc.rect(40, tableTop, 515, 20).fill("#f1f5f9");
          doc.font("Outfit-Bold").fontSize(8).fillColor(primaryColor);
          doc.text("#", 45, tableTop + 5, { width: 20 });
          doc.text("PRODUCT / ITEM", 70, tableTop + 5, { width: 220 });
          doc.text("QTY", 290, tableTop + 5, { width: 50, align: "right" });
          doc.text("PRICE", 350, tableTop + 5, { width: 80, align: "right" });
          doc.text("TOTAL", 440, tableTop + 5, { width: 105, align: "right" });
          doc.font("Outfit").fontSize(8).fillColor("#000000");
        };

        drawTableHeader();
        let y = doc.y + 25;

        const items = purchase.items || [];
        items.forEach((item: any, idx: number) => {
          if (y > 640) {
            doc.addPage();
            doc.y = 40;
            drawTableHeader();
            y = doc.y + 25;
          }

          const price = item.purchase_price ? item.purchase_price / 100 : 0;
          const total = item.line_total ? item.line_total / 100 : price * item.quantity;

          doc.text(String(idx + 1), 45, y, { width: 20 });
          doc.text(item.product_name || `Product #${item.product_id}`, 70, y, { width: 220 });
          doc.text(String(item.quantity), 290, y, { width: 50, align: "right" });
          doc.text(formatInrPdf(price), 350, y, { width: 80, align: "right" });
          doc.text(formatInrPdf(total), 440, y, { width: 105, align: "right" });

          y += 18;
        });

        doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke();
        y += 10;

        if (y > 600) {
          doc.addPage();
          y = 40;
        }

        // Totals
        const grandTotal = purchase.grand_total ? purchase.grand_total / 100 : 0;
        const subtotal = purchase.subtotal ? purchase.subtotal / 100 : grandTotal;
        const discount = purchase.discount ? purchase.discount / 100 : 0;
        const gst = purchase.gst ? purchase.gst / 100 : 0;

        doc.font("Outfit").fontSize(9);
        doc.text("Subtotal:", 350, y);
        doc.text(formatInrPdf(subtotal), 440, y, { align: "right", width: 105 });
        y += 14;

        if (discount > 0) {
          doc.text("Discount:", 350, y);
          doc.text(`-${formatInrPdf(discount)}`, 440, y, { align: "right", width: 105 });
          y += 14;
        }

        if (gst > 0) {
          doc.text("GST Tax:", 350, y);
          doc.text(`+${formatInrPdf(gst)}`, 440, y, { align: "right", width: 105 });
          y += 14;
        }

        doc.font("Outfit-Bold").fontSize(11).fillColor(primaryColor).text("Grand Total:", 350, y);
        doc.text(formatInrPdf(grandTotal), 440, y, { align: "right", width: 105 });

        // Signature & Footer
        const footerY = Math.max(y + 30, 680);
        doc.font("Outfit-Bold").fontSize(8).fillColor(primaryColor).text("FOR STORE", 380, footerY, { align: "center", width: 175 });
        doc.font("Outfit").fontSize(8).fillColor("#64748b").text(signature, 380, footerY + 35, { align: "center", width: 175 });
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(380, footerY + 32).lineTo(555, footerY + 32).stroke();

        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text("Thank you for your business!", 40, 735, { align: "center", width: 515, lineBreak: false });

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).font("Outfit").fillColor("#94a3b8");
          doc.text(`Page ${i + 1} of ${range.count}`, 40, 770, { align: "center", width: 515, lineBreak: false });
        }

        doc.end();
        stream.on("finish", () => resolve(outputPath));
        stream.on("error", (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }
}
