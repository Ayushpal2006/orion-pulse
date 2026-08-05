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
    const website = await settingsRepository.get("business_website", "https://apkabill.in");
    
    // Store-scoped template and settings resolution
    const rawTemplate = receipt.template || (await settingsRepository.get("receipt_template", "Classic"));
    const validTemplates = ["Classic", "Modern", "Retail", "Compact", "Minimal", "GST Professional", "Wholesale", "Restaurant", "Medical", "Fashion", "Thermal", "Premium"];
    const template = (rawTemplate && validTemplates.includes(String(rawTemplate).trim())) ? String(rawTemplate).trim() : "Classic";
    
    const qrPosition = receipt.qrPosition || (await settingsRepository.get("qr_position", "Bottom"));
    const invoiceHeader = receipt.invoiceHeader !== undefined ? receipt.invoiceHeader : (await settingsRepository.get("invoice_header", ""));
    const termsAndConditions = receipt.termsAndConditions !== undefined ? receipt.termsAndConditions : (await settingsRepository.get("terms_and_conditions", ""));

    return new Promise((resolve, reject) => {
      try {
        const PDFDocument = getPDFDocument();
        const isCompact = template === "Compact";
        const margin = isCompact ? 25 : 40;
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const contentWidth = pageWidth - 2 * margin;

        const doc = new PDFDocument({ size: "A4", margins: { top: margin, bottom: 20, left: margin, right: margin }, bufferPages: true });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
        doc.on("error", (err: any) => reject(err));

        configurePdfFonts(doc);

        // Color theme palette based on selected store template
        let primaryColor = "#0f172a"; // Classic slate navy
        if (template === "Modern") primaryColor = "#2563eb"; // Vibrant Royal Blue
        else if (template === "GST Professional") primaryColor = "#047857"; // Emerald Green
        else if (template === "Retail") primaryColor = "#7c3aed"; // Violet / Retail
        else if (template === "Minimal") primaryColor = "#334155"; // Dark Graphite Slate
        else if (template === "Wholesale") primaryColor = "#1e3a8a"; // Deep Navy Blue
        else if (template === "Restaurant") primaryColor = "#d97706"; // Amber Gold
        else if (template === "Medical") primaryColor = "#0891b2"; // Cyan Teal
        else if (template === "Fashion") primaryColor = "#be185d"; // Rose Pink / Magenta
        else if (template === "Thermal") primaryColor = "#18181b"; // Monochrome High-Contrast
        else if (template === "Premium") primaryColor = "#1d4ed8"; // Premium Indigo

        // Top Decorative Accent Banner for Modern, Premium, and GST Professional templates
        if (template === "Premium" || template === "Modern" || template === "GST Professional") {
          doc.rect(0, 0, pageWidth, 8).fill(primaryColor);
        }

        const startY = (template === "Premium" || template === "Modern" || template === "GST Professional") ? 25 : 35;

        // Header Notice Tag
        if (invoiceHeader) {
          doc.font("Outfit-Bold").fontSize(8).fillColor("#64748b").text(String(invoiceHeader).toUpperCase(), margin, startY - 10);
        }

        // Store Logo placement on top right (fit within max 120x50, keeping aspect ratio, preventing overlap)
        if (receipt.shop?.logo && receipt.shop.logo.startsWith("data:image/")) {
          try {
            const base64Data = receipt.shop.logo.split(",")[1];
            if (base64Data) {
              const logoBuffer = Buffer.from(base64Data, "base64");
              doc.image(logoBuffer, pageWidth - margin - 125, startY, { fit: [125, 50], align: "right", valign: "top" });
            }
          } catch (e) {
            console.error("Failed to render logo in PDF invoice:", e);
          }
        }

        // Store Title & Header Metadata
        const shopTitleWidth = 350;
        doc.font("Outfit-Bold").fontSize(template === "Premium" ? 22 : 18).fillColor(primaryColor).text(receipt.shop?.name || "APKA BILL STORE", margin, startY, { width: shopTitleWidth });
        doc.font("Outfit").fontSize(8.5).fillColor("#475569");
        doc.text(receipt.shop?.address || "", { width: shopTitleWidth });
        doc.text(`Phone: ${receipt.shop?.phone || "-"} | Email: ${receipt.shop?.email || "support@apkabill.in"} | GSTIN: ${receipt.shop?.gstin || "-"}`, { width: shopTitleWidth });

        doc.moveDown(0.8);

        // Header Divider Line
        doc.strokeColor(template === "Premium" ? primaryColor : "#cbd5e1").lineWidth(template === "Premium" ? 1.5 : 1).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
        doc.moveDown(0.6);

        // Two-Column Area: BILL TO (Left) vs INVOICE DETAILS (Right)
        const metaY = doc.y;
        const leftMetaWidth = 250;
        doc.font("Outfit-Bold").fontSize(9.5).fillColor(primaryColor).text("BILL TO:", margin, metaY);
        doc.font("Outfit").fontSize(9).fillColor("#000000").text(receipt.customer?.name || "Walk-in Customer", margin, metaY + 14, { width: leftMetaWidth });
        if (receipt.customer?.phone) {
          doc.text(`Phone: +91 ${receipt.customer.phone}`, margin, metaY + 26, { width: leftMetaWidth });
        }

        const rightMetaX = 330;
        const rightMetaWidth = pageWidth - margin - rightMetaX;
        doc.font("Outfit-Bold").fontSize(9.5).fillColor(primaryColor).text("INVOICE DETAILS:", rightMetaX, metaY);
        doc.font("Outfit").fontSize(9).fillColor("#000000").text(`Invoice #: ${receipt.invoiceNumber}`, rightMetaX, metaY + 14, { width: rightMetaWidth });
        doc.text(`Date & Time: ${receipt.date} ${receipt.time}`, rightMetaX, metaY + 26, { width: rightMetaWidth });
        doc.text(`Cashier: ${receipt.cashier || "Admin"}`, rightMetaX, metaY + 38, { width: rightMetaWidth });

        if (receipt.status === "VOID") {
          doc.font("Outfit-Bold").fillColor("#ef4444").text("STATUS: VOID (Cancelled)", rightMetaX, metaY + 50, { width: rightMetaWidth });
          doc.font("Outfit").fillColor("#ef4444").text(`Reason: ${receipt.voidReason || "N/A"}`, rightMetaX, metaY + 62, { width: rightMetaWidth });
          doc.fillColor("#000000");
        }

        const metaHeight = receipt.status === "VOID" ? 78 : 52;
        doc.y = metaY + metaHeight + 12;

        // Top Payment QR Position Option
        if (qrPosition === "Top" && receipt.paymentMethod === "UPI" && receipt.upiQrCode) {
          try {
            const base64Data = receipt.upiQrCode.split(",")[1];
            if (base64Data) {
              const qrBuffer = Buffer.from(base64Data, "base64");
              const qrY = doc.y;
              doc.image(qrBuffer, margin, qrY, { width: 60 });
              doc.font("Outfit").fontSize(8).fillColor("#64748b").text("Scan to Pay via UPI", margin, qrY + 63);
              doc.y = qrY + 75;
            }
          } catch (e) {
            console.error("Failed to render top QR code in PDF:", e);
          }
        }

        // Table Header Generator
        const drawTableHeader = () => {
          const tableY = doc.y;
          const bgHeader = (template === "Premium" || template === "GST Professional") ? primaryColor : "#f1f5f9";
          const fgHeader = (template === "Premium" || template === "GST Professional") ? "#ffffff" : primaryColor;
          doc.rect(margin, tableY - 4, contentWidth, 20).fill(bgHeader);
          doc.font("Outfit-Bold").fontSize(8.5).fillColor(fgHeader);

          doc.text("Item Details", margin + 5, tableY + 1, { width: 205 });
          doc.text("Qty", margin + 215, tableY + 1, { width: 40, align: "right" });
          doc.text("Rate", margin + 260, tableY + 1, { width: 65, align: "right" });
          doc.text("Disc", margin + 330, tableY + 1, { width: 45, align: "right" });
          doc.text("GST %", margin + 380, tableY + 1, { width: 45, align: "right" });
          doc.text("Total Amount", margin + 430, tableY + 1, { width: 80, align: "right" });

          doc.moveDown(0.8);
          doc.font("Outfit").fontSize(8.5).fillColor("#000000");
        };

        drawTableHeader();

        // Table Rows Loop
        for (const item of (receipt.items || [])) {
          if (doc.y > 670) {
            doc.addPage();
            doc.y = margin;
            drawTableHeader();
          }

          const rowY = doc.y;
          doc.text(item.name || "Item", margin + 5, rowY, { width: 205 });
          doc.text(String(item.qty || 1), margin + 215, rowY, { width: 40, align: "right" });
          doc.text(formatInrPdf(item.price), margin + 260, rowY, { width: 65, align: "right" });
          doc.text(`${item.discount || 0}%`, margin + 330, rowY, { width: 45, align: "right" });
          doc.text(`${item.gst || 0}%`, margin + 380, rowY, { width: 45, align: "right" });
          doc.text(formatInrPdf(item.lineTotal), margin + 430, rowY, { width: 80, align: "right" });

          doc.moveDown(0.8);
        }

        doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
        doc.moveDown(0.5);

        // Summary Block Page Break Check
        if (doc.y > 640) {
          doc.addPage();
          doc.y = margin;
        }

        const summaryStartY = doc.y + 8;

        // Left Block: Payment Details & QR Code
        doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text("PAYMENT & TRANSACTION DETAILS", margin, summaryStartY);
        doc.font("Outfit").fontSize(8.5).fillColor("#000000").text(`Method: ${receipt.paymentMethod || "Cash"}`, margin, summaryStartY + 14);
        doc.text(`Status: ${receipt.status === "VOID" ? "VOID (Cancelled)" : "Paid"}`, margin, summaryStartY + 26);

        let leftBlockHeight = 45;
        if (receipt.paymentMethod === "UPI") {
          doc.text(`UPI ID: ${receipt.shop?.upiId || "apkabill@upi"}`, margin, summaryStartY + 38, { width: 220 });
          leftBlockHeight = 52;

          if (qrPosition === "Bottom" && receipt.upiQrCode) {
            try {
              const base64Data = receipt.upiQrCode.split(",")[1];
              if (base64Data) {
                const qrBuffer = Buffer.from(base64Data, "base64");
                const qrY = summaryStartY + 50;
                doc.image(qrBuffer, margin, qrY, { width: 60 });
                doc.font("Outfit").fontSize(7.5).fillColor("#64748b").text("Scan to Pay via UPI", margin, qrY + 63);
                leftBlockHeight = 125;
              }
            } catch (e) {
              console.error("Failed to render QR code in PDF:", e);
            }
          }
        }

        // Right Block: Subtotal, Discount, Tax, Grand Total
        const rightLabelX = 330;
        const rightValueX = 440;
        const valWidth = 105;

        doc.font("Outfit").fontSize(8.5).fillColor("#475569");
        doc.text("Subtotal:", rightLabelX, summaryStartY);
        doc.text(formatInrPdf(receipt.subtotal), rightValueX, summaryStartY, { align: "right", width: valWidth });

        doc.text("Discount:", rightLabelX, summaryStartY + 14);
        doc.text(`-${formatInrPdf(receipt.discount)}`, rightValueX, summaryStartY + 14, { align: "right", width: valWidth });

        doc.text("GST Tax:", rightLabelX, summaryStartY + 28);
        doc.text(`+${formatInrPdf(receipt.gst)}`, rightValueX, summaryStartY + 28, { align: "right", width: valWidth });

        // Grand Total Box Styling
        const grandTotalBoxY = summaryStartY + 44;
        doc.rect(rightLabelX - 5, grandTotalBoxY, 220, 24).fill(primaryColor);
        doc.font("Outfit-Bold").fontSize(10.5).fillColor("#ffffff").text("Grand Total:", rightLabelX + 5, grandTotalBoxY + 6);
        doc.text(formatInrPdf(receipt.grandTotal), rightValueX, grandTotalBoxY + 6, { align: "right", width: valWidth });

        const rightBlockHeight = 78;
        const summaryHeight = Math.max(leftBlockHeight, rightBlockHeight);
        doc.y = summaryStartY + summaryHeight + 12;

        // Terms and Signature Section
        if (doc.y > 670) {
          doc.addPage();
          doc.y = margin;
        }

        const footerBlockY = doc.y;

        // Left Side: Terms and Conditions / Store Policy (Render ONLY if configured)
        if (termsAndConditions && String(termsAndConditions).trim().length > 0) {
          doc.font("Outfit-Bold").fontSize(8).fillColor(primaryColor).text("TERMS & CONDITIONS:", margin, footerBlockY);
          doc.font("Outfit").fontSize(7.5).fillColor("#475569").text(String(termsAndConditions).trim(), margin, footerBlockY + 12, { width: 270 });
        }
        if (website) {
          const webY = (termsAndConditions && String(termsAndConditions).trim().length > 0) ? footerBlockY + 38 : footerBlockY;
          doc.font("Outfit").fontSize(7.5).fillColor("#475569").text(`Website: ${website}`, margin, webY);
        }

        // Right Side: Authorized Signature (Strictly right-aligned)
        const sigX = 350;
        const sigWidth = 205;
        doc.font("Outfit-Bold").fontSize(8.5).fillColor(primaryColor).text(`FOR ${(receipt.shop?.name || "STORE").toUpperCase()}`, sigX, footerBlockY, { align: "right", width: sigWidth });
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(sigX + 30, footerBlockY + 35).lineTo(sigX + sigWidth, footerBlockY + 35).stroke();
        doc.font("Outfit").fontSize(7.5).fillColor("#64748b").text(signature, sigX, footerBlockY + 40, { align: "right", width: sigWidth });

        // Bottom Page Footers
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

          const footerY = pageHeight - 55;
          doc.font("Outfit-Bold").fontSize(8).fillColor(primaryColor).text(receipt.thankYouMessage || "Thank you for your business!", margin, footerY, { align: "center", width: contentWidth, lineBreak: false });
          doc.font("Outfit").fontSize(7).fillColor("#94a3b8").text("Generated automatically via Apka Bill POS ecosystem.", margin, footerY + 12, { align: "center", width: contentWidth, lineBreak: false });
          doc.text(`Page ${i + 1} of ${range.count}`, margin, footerY + 22, { align: "center", width: contentWidth, lineBreak: false });
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
