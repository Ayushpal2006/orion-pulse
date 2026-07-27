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
    const template = await settingsRepository.get("receipt_template", "Classic");
    const qrPosition = await settingsRepository.get("qr_position", "Bottom");
    const invoiceHeader = await settingsRepository.get("invoice_header", "");
    const termsAndConditions = await settingsRepository.get("terms_and_conditions", "");

    return new Promise((resolve, reject) => {
      try {
        const PDFDocument = getPDFDocument();
        const isCompact = template === "Compact";
        const margin = isCompact ? 25 : 40;
        const doc = new PDFDocument({ size: "A4", margin, bufferPages: true });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
        doc.on("error", (err: any) => {
          reject(err);
        });

        configurePdfFonts(doc);

        // Primary Theme color palette selection
        let primaryColor = "#0f172a"; // classic slate
        if (theme === "clean" || template === "Premium") primaryColor = "#2563eb"; // vibrant blue
        if (theme === "dark") primaryColor = "#1e293b"; // charcoal

        // Top Accent Banner for Premium template
        if (template === "Premium") {
          doc.rect(0, 0, 595, 10).fill(primaryColor);
        }

        // Business Logo at top right if configured
        if (receipt.shop.logo && receipt.shop.logo.startsWith("data:image/")) {
          try {
            const base64Data = receipt.shop.logo.split(",")[1];
            if (base64Data) {
              const logoBuffer = Buffer.from(base64Data, "base64");
              doc.image(logoBuffer, 450, template === "Premium" ? 25 : 40, { width: 100 });
            }
          } catch (e) {
            console.error("Failed to render logo in PDF invoice:", e);
          }
        }

        const startY = template === "Premium" ? 30 : 40;

        // Header Notice Tag
        if (invoiceHeader) {
          doc.font("Outfit-Bold").fontSize(8).fillColor("#64748b").text(invoiceHeader.toUpperCase(), margin, startY - 10);
        }

        // Title Block
        doc.font("Outfit-Bold").fontSize(template === "Premium" ? 26 : 22).fillColor(primaryColor).text(receipt.shop.name, margin, startY, { width: 390 });
        doc.font("Outfit").fontSize(9).fillColor("#475569");
        doc.text(receipt.shop.address, { width: 390 });
        doc.text(`Phone: ${receipt.shop.phone} | Email: ${receipt.shop.email || "support@apkabill.in"} | GSTIN: ${receipt.shop.gstin}`, { width: 390 });
        
        doc.moveDown(1.2);
        
        // Divider
        doc.strokeColor(template === "Premium" ? primaryColor : "#cbd5e1").lineWidth(template === "Premium" ? 2 : 1).moveTo(margin, doc.y).lineTo(595 - margin, doc.y).stroke();
        doc.moveDown(0.8);

        // Metadata columns (Left: Customer, Right: Invoice meta)
        const metaY = doc.y;
        doc.font("Outfit-Bold").fontSize(10).fillColor(primaryColor).text("BILL TO:", margin, metaY);
        doc.font("Outfit").fillColor("#000000").text(receipt.customer.name, margin, metaY + 14);
        if (receipt.customer.phone) {
          doc.text(`Phone: +91 ${receipt.customer.phone}`, margin, metaY + 26);
        }

        doc.font("Outfit-Bold").fillColor(primaryColor).text("INVOICE DETAILS:", 350, metaY);
        doc.font("Outfit").fillColor("#000000").text(`Invoice Number: ${receipt.invoiceNumber}`, 350, metaY + 14);
        doc.text(`Date & Time: ${receipt.date} ${receipt.time}`, 350, metaY + 26);
        doc.text(`Cashier: ${receipt.cashier}`, 350, metaY + 38);
        doc.text(`Template Layout: ${template}`, 350, metaY + 50);

        if (receipt.status === "VOID") {
          doc.font("Outfit-Bold").fillColor("#ef4444").text("STATUS: VOID", 350, metaY + 62);
          doc.font("Outfit").fillColor("#ef4444").text(`Reason: ${receipt.voidReason || "N/A"}`, 350, metaY + 74);
          doc.fillColor("#000000"); // Reset color
        }

        const detailsBottomY = receipt.status === "VOID" ? metaY + 90 : metaY + 65;
        doc.y = Math.max(doc.y, detailsBottomY);
        doc.moveDown(0.5);

        // Optional Top QR position
        if (qrPosition === "Top" && receipt.paymentMethod === "UPI" && receipt.upiQrCode) {
          try {
            const base64Data = receipt.upiQrCode.split(",")[1];
            if (base64Data) {
              const qrBuffer = Buffer.from(base64Data, "base64");
              const qrY = doc.y;
              doc.image(qrBuffer, margin, qrY, { width: 70 });
              doc.font("Outfit").fontSize(8).fillColor("#64748b").text("Scan to Pay via UPI", margin, qrY + 72);
              doc.y = qrY + 85;
            }
          } catch (e) {
            console.error("Failed to render top QR code in PDF:", e);
          }
        }

        // Helper function to draw table header
        const drawTableHeader = () => {
          const tableY = doc.y;
          const bgHeader = template === "Premium" ? primaryColor : "#f1f5f9";
          const fgHeader = template === "Premium" ? "#ffffff" : primaryColor;
          doc.rect(margin, tableY - 4, 595 - 2 * margin, 20).fill(bgHeader);
          doc.font("Outfit-Bold").fontSize(9).fillColor(fgHeader);
          
          if (template === "Detailed" || template === "Retail") {
            doc.text("Item Description & HSN", margin + 5, tableY + 1, { width: 170 });
            doc.text("Qty", margin + 180, tableY + 1, { width: 35, align: "right" });
            doc.text("Rate", margin + 220, tableY + 1, { width: 60, align: "right" });
            doc.text("Disc", margin + 285, tableY + 1, { width: 45, align: "right" });
            doc.text("CGST", margin + 335, tableY + 1, { width: 45, align: "right" });
            doc.text("SGST", margin + 385, tableY + 1, { width: 45, align: "right" });
            doc.text("Total Amount", margin + 435, tableY + 1, { width: 75, align: "right" });
          } else {
            doc.text("Item Details", margin + 5, tableY + 1, { width: 210 });
            doc.text("Qty", margin + 220, tableY + 1, { width: 40, align: "right" });
            doc.text("Rate", margin + 265, tableY + 1, { width: 70, align: "right" });
            doc.text("Disc", margin + 340, tableY + 1, { width: 50, align: "right" });
            doc.text("GST %", margin + 395, tableY + 1, { width: 45, align: "right" });
            doc.text("Total Amount", margin + 445, tableY + 1, { width: 65, align: "right" });
          }
          doc.moveDown(0.8);
          doc.font("Outfit").fontSize(9).fillColor("#000000");
        };

        drawTableHeader();

        // Table rows
        for (const item of receipt.items) {
          if (doc.y > 640) {
            doc.addPage();
            doc.y = margin;
            drawTableHeader();
          }

          const rowY = doc.y;
          if (template === "Detailed" || template === "Retail") {
            const halfGst = (item.gst || 0) / 2;
            doc.text(item.name, margin + 5, rowY, { width: 170 });
            doc.text(String(item.qty), margin + 180, rowY, { width: 35, align: "right" });
            doc.text(formatInrPdf(item.price), margin + 220, rowY, { width: 60, align: "right" });
            doc.text(`${item.discount || 0}%`, margin + 285, rowY, { width: 45, align: "right" });
            doc.text(`${halfGst}%`, margin + 335, rowY, { width: 45, align: "right" });
            doc.text(`${halfGst}%`, margin + 385, rowY, { width: 45, align: "right" });
            doc.text(formatInrPdf(item.lineTotal), margin + 435, rowY, { width: 75, align: "right" });
          } else {
            doc.text(item.name, margin + 5, rowY, { width: 210 });
            doc.text(String(item.qty), margin + 220, rowY, { width: 40, align: "right" });
            doc.text(formatInrPdf(item.price), margin + 265, rowY, { width: 70, align: "right" });
            doc.text(`${item.discount || 0}%`, margin + 340, rowY, { width: 50, align: "right" });
            doc.text(`${item.gst || 0}%`, margin + 395, rowY, { width: 45, align: "right" });
            doc.text(formatInrPdf(item.lineTotal), margin + 445, rowY, { width: 65, align: "right" });
          }
          doc.moveDown(0.8);
        }

        doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(margin, doc.y).lineTo(595 - margin, doc.y).stroke();
        doc.moveDown(0.8);

        // Summary calculations block (Add page if not enough space)
        if (doc.y > 600) {
          doc.addPage();
          doc.y = margin;
        }

        const totalsY = doc.y;
        const rightLabelX = 340;
        const rightValueX = 445;
        const rightValWidth = 65;

        doc.font("Outfit").fontSize(9).fillColor("#475569");
        doc.text("Subtotal:", rightLabelX, totalsY);
        doc.text(formatInrPdf(receipt.subtotal), rightValueX, totalsY, { align: "right", width: rightValWidth });
        
        doc.text("Discount:", rightLabelX, totalsY + 14);
        doc.text(`-${formatInrPdf(receipt.discount)}`, rightValueX, totalsY + 14, { align: "right", width: rightValWidth });

        doc.text("GST Tax:", rightLabelX, totalsY + 28);
        doc.text(`+${formatInrPdf(receipt.gst)}`, rightValueX, totalsY + 28, { align: "right", width: rightValWidth });

        if (template === "Premium") {
          doc.rect(rightLabelX - 5, totalsY + 44, 185, 24).fill(primaryColor);
          doc.font("Outfit-Bold").fontSize(11).fillColor("#ffffff").text("Grand Total:", rightLabelX, totalsY + 50);
          doc.text(formatInrPdf(receipt.grandTotal), rightValueX, totalsY + 50, { align: "right", width: rightValWidth });
        } else {
          doc.rect(rightLabelX, totalsY + 42, 170, 1).fill(primaryColor);
          doc.font("Outfit-Bold").fontSize(11).fillColor(primaryColor).text("Grand Total:", rightLabelX, totalsY + 48);
          doc.text(formatInrPdf(receipt.grandTotal), rightValueX, totalsY + 48, { align: "right", width: rightValWidth });
        }

        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text("PAYMENT & TRANSACTION DETAILS", margin, totalsY);
        doc.font("Outfit").fillColor("#000000").text(`Method: ${receipt.paymentMethod}`, margin, totalsY + 14);
        doc.text(`Status: ${receipt.status === "VOID" ? "VOID (Cancelled)" : "Paid"}`, margin, totalsY + 26);
        if (receipt.paymentMethod === "UPI") {
          doc.text(`UPI ID: ${receipt.shop.upiId || "apkabill@upi"}`, margin, totalsY + 38, { width: 170 });
          
          if (qrPosition === "Bottom" && receipt.upiQrCode) {
            try {
              const base64Data = receipt.upiQrCode.split(",")[1];
              if (base64Data) {
                const qrBuffer = Buffer.from(base64Data, "base64");
                doc.image(qrBuffer, margin + 175, totalsY, { width: 75 });
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
          doc.y = margin;
        }

        const finalPolicyY = doc.y;
        doc.font("Outfit-Bold").fontSize(8).fillColor(primaryColor).text("EXCHANGE POLICY & TERMS:", margin, finalPolicyY);
        doc.font("Outfit").fillColor("#475569").text(termsAndConditions || exchangePolicy, margin, finalPolicyY + 12, { width: 250 });
        if (website) doc.text(`Website: ${website}`, margin, finalPolicyY + 40);

        const sigX = 380;
        doc.font("Outfit-Bold").fillColor(primaryColor).text(`FOR ${receipt.shop.name.toUpperCase()}`, sigX, finalPolicyY, { align: "center", width: 175 });
        doc.font("Outfit").fontSize(8).fillColor("#64748b").text(signature, sigX, finalPolicyY + 35, { align: "center", width: 175 });
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(sigX, finalPolicyY + 32).lineTo(sigX + 175, finalPolicyY + 32).stroke();

        // Footer note
        const bottomFooterY = 740;
        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text(receipt.thankYouMessage, margin, bottomFooterY, { align: "center", width: 595 - 2 * margin, lineBreak: false });
        doc.font("Outfit").fontSize(7).fillColor("#94a3b8").text("Generated automatically via Apka Bill POS ecosystem.", margin, bottomFooterY + 14, { align: "center", width: 595 - 2 * margin, lineBreak: false });

        // Dynamic page numbers for multi-page invoices
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
          doc.text(`Page ${i + 1} of ${range.count}`, margin, 770, { align: "center", width: 595 - 2 * margin, lineBreak: false });
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
