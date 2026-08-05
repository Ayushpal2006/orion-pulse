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
    const dbPrimaryColor = await settingsRepository.get("primary_color", "");
    
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
        
        const isA4 = template === "Wholesale" || template === "GST Professional";
        const is58mm = template === "Compact";
        
        // Paper Dimensions Configuration
        let pdfSize: any = [226.77, 650]; // Default 80mm thermal roll width
        let margin = 8;
        let pageWidth = 226.77;

        if (isA4) {
          pdfSize = "A4";
          margin = 35;
          pageWidth = 595.28;
        } else if (is58mm) {
          pdfSize = [164.4, 450]; // 58mm width
          margin = 5;
          pageWidth = 164.4;
        }

        const contentWidth = pageWidth - 2 * margin;

        const doc = new PDFDocument({
          size: pdfSize,
          margins: { top: margin, bottom: margin, left: margin, right: margin },
          bufferPages: true
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
        doc.on("error", (err: any) => reject(err));

        configurePdfFonts(doc);

        let primaryColor = dbPrimaryColor || "#0f172a";
        if (template === "Modern") primaryColor = dbPrimaryColor || "#2563eb";
        else if (template === "GST Professional" || template === "Wholesale") primaryColor = dbPrimaryColor || "#047857";
        else if (template === "Retail") primaryColor = dbPrimaryColor || "#7c3aed";

        // =========================================================
        // 1. A4 TEMPLATES (Wholesale & GST Professional) — SCREENSHOT 5
        // =========================================================
        if (isA4) {
          // Outer Border Box
          doc.rect(margin, margin, contentWidth, 770).strokeColor(primaryColor).lineWidth(1.5).stroke();

          let curY = margin + 12;

          // Header Title
          doc.font("Outfit-Bold").fontSize(13).fillColor(primaryColor).text("TAX INVOICE", margin, curY, { align: "center", width: contentWidth });
          curY += 18;
          doc.font("Outfit-Bold").fontSize(16).fillColor("#000000").text(receipt.shop?.name || "STORE", margin, curY, { align: "center", width: contentWidth });
          curY += 20;
          doc.font("Outfit").fontSize(8.5).fillColor("#475569").text(receipt.shop?.address || "", margin, curY, { align: "center", width: contentWidth });
          curY += 14;

          // Green Banner Bar
          doc.rect(margin + 10, curY, contentWidth - 20, 18).fill(primaryColor);
          doc.font("Outfit-Bold").fontSize(9).fillColor("#ffffff").text(`GSTIN: ${receipt.shop?.gstin || "-"} | PH: ${receipt.shop?.phone || "-"}`, margin + 10, curY + 4, { align: "center", width: contentWidth - 20 });
          curY += 26;

          // 2-Column Info Grid
          const gridW = (contentWidth - 30) / 2;
          const leftX = margin + 10;
          const rightX = margin + 20 + gridW;

          doc.rect(leftX, curY, gridW, 46).strokeColor(primaryColor).lineWidth(1).stroke();
          doc.font("Outfit-Bold").fontSize(8.5).fillColor(primaryColor).text("DETAILS OF RECEIVER / BUYER", leftX + 6, curY + 6);
          doc.font("Outfit").fontSize(8).fillColor("#000").text(`Name: ${receipt.customer?.name || "Walk-in Customer"}`, leftX + 6, curY + 18);
          doc.text(`Phone: +91 ${receipt.customer?.phone || "-"}`, leftX + 6, curY + 30);

          doc.rect(rightX, curY, gridW, 46).strokeColor(primaryColor).lineWidth(1).stroke();
          doc.font("Outfit-Bold").fontSize(8.5).fillColor(primaryColor).text("INVOICE SPECIFICATION", rightX + 6, curY + 6);
          doc.font("Outfit").fontSize(8).fillColor("#000").text(`Invoice No: ${receipt.invoiceNumber}`, rightX + 6, curY + 18);
          doc.text(`Date & Time: ${receipt.date} ${receipt.time}`, rightX + 6, curY + 30);

          curY += 56;

          // Table Header
          doc.rect(margin + 10, curY, contentWidth - 20, 20).fill(primaryColor);
          doc.font("Outfit-Bold").fontSize(8.5).fillColor("#ffffff");
          doc.text("Item Description", margin + 16, curY + 5, { width: 220 });
          doc.text("Qty", margin + 240, curY + 5, { width: 35, align: "center" });
          doc.text("Rate", margin + 280, curY + 5, { width: 65, align: "right" });
          doc.text("Tax %", margin + 350, curY + 5, { width: 45, align: "right" });
          doc.text("Total", margin + 400, curY + 5, { width: 95, align: "right" });

          curY += 20;

          // Item Rows
          doc.font("Outfit").fontSize(8.5).fillColor("#000");
          for (const item of (receipt.items || [])) {
            doc.text(item.name || "Item", margin + 16, curY + 4, { width: 220 });
            doc.text(String(item.qty || 1), margin + 240, curY + 4, { width: 35, align: "center" });
            doc.text(formatInrPdf(item.price), margin + 280, curY + 4, { width: 65, align: "right" });
            doc.text(`${item.gst || 0}%`, margin + 350, curY + 4, { width: 45, align: "right" });
            doc.text(formatInrPdf(item.lineTotal), margin + 400, curY + 4, { width: 95, align: "right" });

            curY += 16;
            doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(margin + 10, curY).lineTo(margin + contentWidth - 10, curY).stroke();
          }

          curY += 10;

          // 2-Column Summary Box
          const sumBoxW = (contentWidth - 30) / 2;
          doc.rect(leftX, curY, sumBoxW, 58).strokeColor("#cbd5e1").lineWidth(1).stroke();
          doc.font("Outfit-Bold").fontSize(8.5).fillColor(primaryColor).text("TAX SUMMARY", leftX + 6, curY + 6);
          doc.font("Outfit").fontSize(8).fillColor("#000").text(`Taxable Amount: ${formatInrPdf(receipt.subtotal - receipt.discount)}`, leftX + 6, curY + 18);
          doc.text(`CGST + SGST (GST): ${formatInrPdf(receipt.gst)}`, leftX + 6, curY + 30);
          doc.font("Outfit").fontSize(7.5).fillColor("#64748b").text("Tax Invoice issued under GST Rules.", leftX + 6, curY + 42);

          doc.rect(rightX, curY, sumBoxW, 58).fillAndStroke("#f0fdf4", primaryColor);
          doc.font("Outfit").fontSize(8).fillColor("#000").text("Subtotal:", rightX + 6, curY + 6);
          doc.text(formatInrPdf(receipt.subtotal), rightX + sumBoxW - 85, curY + 6, { align: "right", width: 75 });

          doc.fillColor("#dc2626").text("Discount:", rightX + 6, curY + 18);
          doc.text(`-${formatInrPdf(receipt.discount)}`, rightX + sumBoxW - 85, curY + 18, { align: "right", width: 75 });

          doc.fillColor("#000").text("Total Tax:", rightX + 6, curY + 30);
          doc.text(formatInrPdf(receipt.gst), rightX + sumBoxW - 85, curY + 30, { align: "right", width: 75 });

          doc.font("Outfit-Bold").fontSize(10).fillColor(primaryColor).text("GRAND TOTAL:", rightX + 6, curY + 44);
          doc.text(formatInrPdf(receipt.grandTotal), rightX + sumBoxW - 95, curY + 44, { align: "right", width: 85 });

          curY += 75;

          // QR Code + Signatory
          if (receipt.paymentMethod === "UPI" && receipt.upiQrCode) {
            try {
              const base64Data = receipt.upiQrCode.split(",")[1];
              if (base64Data) {
                const qrBuffer = Buffer.from(base64Data, "base64");
                doc.image(qrBuffer, leftX, curY, { width: 65 });
                doc.font("Outfit-Bold").fontSize(8).fillColor(primaryColor).text("Paid via UPI", leftX, curY + 68);
              }
            } catch (e) {}
          }

          doc.font("Outfit-Bold").fontSize(8.5).fillColor(primaryColor).text(`FOR ${(receipt.shop?.name || "STORE").toUpperCase()}`, rightX, curY, { align: "right", width: sumBoxW });
          doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(rightX + 30, curY + 45).lineTo(rightX + sumBoxW, curY + 45).stroke();
          doc.font("Outfit").fontSize(7.5).fillColor("#64748b").text(signature, rightX, curY + 50, { align: "right", width: sumBoxW });

          const footerY = 760;
          doc.font("Outfit").fontSize(7.5).fillColor("#64748b").text(receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt.", margin, footerY, { align: "center", width: contentWidth });
        }
        // =========================================================
        // 2. MODERN TEMPLATE (80mm) — SCREENSHOT 2
        // =========================================================
        else if (template === "Modern") {
          let curY = margin;

          doc.rect(margin, curY, contentWidth, 42).fill(primaryColor);
          if (receipt.shop?.logo && receipt.shop.logo.startsWith("data:image/")) {
            try {
              const base64Data = receipt.shop.logo.split(",")[1];
              if (base64Data) {
                const logoBuffer = Buffer.from(base64Data, "base64");
                doc.image(logoBuffer, margin + 8, curY + 6, { fit: [30, 30] });
              }
            } catch (e) {}
          }

          doc.font("Outfit-Bold").fontSize(11).fillColor("#ffffff").text((receipt.shop?.name || "STORE").toUpperCase(), margin, curY + 6, { align: "center", width: contentWidth });
          doc.font("Outfit").fontSize(7).fillColor("#ffffff").text(`${receipt.shop?.phone || "-"} | GSTIN: ${receipt.shop?.gstin || "-"}`, margin, curY + 22, { align: "center", width: contentWidth });
          curY += 48;

          // Grey Metadata Grid
          doc.rect(margin, curY, contentWidth, 24).fillAndStroke("#f1f5f9", "#e2e8f0");
          doc.font("Outfit-Bold").fontSize(7.5).fillColor("#000000");
          doc.text(`INV #: ${receipt.invoiceNumber}`, margin + 4, curY + 4);
          doc.text(`DATE: ${receipt.date}`, margin + 110, curY + 4, { align: "right", width: 90 });
          doc.text(`CUST: ${receipt.customer?.name || "Walk-in Customer"}`, margin + 4, curY + 14);
          doc.text(`CASH: ${receipt.cashier || "Admin"}`, margin + 110, curY + 14, { align: "right", width: 90 });
          curY += 28;

          // Item Table
          doc.rect(margin, curY, contentWidth, 14).fill(primaryColor);
          doc.font("Outfit-Bold").fontSize(7.5).fillColor("#ffffff");
          doc.text("Item Description", margin + 4, curY + 3);
          doc.text("Qty", margin + 120, curY + 3, { width: 25, align: "center" });
          doc.text("Amount", margin + contentWidth - 45, curY + 3, { width: 45, align: "right" });
          curY += 14;

          let rIdx = 0;
          doc.font("Outfit").fontSize(7.5).fillColor("#000");
          for (const item of (receipt.items || [])) {
            if (rIdx % 2 === 1) {
              doc.rect(margin, curY, contentWidth, 12).fill("#f8fafc");
              doc.fillColor("#000");
            }
            doc.text(item.name || "Item", margin + 4, curY + 2, { width: 115 });
            doc.text(String(item.qty || 1), margin + 120, curY + 2, { width: 25, align: "center" });
            doc.text(formatInrPdf(item.lineTotal), margin + contentWidth - 45, curY + 2, { width: 45, align: "right" });
            curY += 12;
            rIdx++;
          }

          curY += 4;

          // Totals Box
          doc.rect(margin, curY, contentWidth, 42).fillAndStroke("#f8fafc", "#e2e8f0");
          doc.font("Outfit").fontSize(7.5).fillColor("#000");
          doc.text("Subtotal:", margin + 4, curY + 4);
          doc.text(formatInrPdf(receipt.subtotal), margin + contentWidth - 55, curY + 4, { align: "right", width: 50 });

          doc.fillColor("#dc2626").text("Discount:", margin + 4, curY + 14);
          doc.text(`-${formatInrPdf(receipt.discount)}`, margin + contentWidth - 55, curY + 14, { align: "right", width: 50 });

          doc.fillColor("#000").text("Tax:", margin + 4, curY + 24);
          doc.text(formatInrPdf(receipt.gst), margin + contentWidth - 55, curY + 24, { align: "right", width: 50 });

          doc.strokeColor(primaryColor).lineWidth(1).moveTo(margin + 4, curY + 34).lineTo(margin + contentWidth - 4, curY + 34).stroke();
          doc.font("Outfit-Bold").fontSize(9).fillColor(primaryColor).text("GRAND TOTAL:", margin + 4, curY + 35);
          doc.text(formatInrPdf(receipt.grandTotal), margin + contentWidth - 65, curY + 35, { align: "right", width: 60 });
          curY += 48;

          // QR Code
          if (receipt.paymentMethod === "UPI" && receipt.upiQrCode) {
            try {
              const base64Data = receipt.upiQrCode.split(",")[1];
              if (base64Data) {
                const qrBuffer = Buffer.from(base64Data, "base64");
                doc.font("Outfit-Bold").fontSize(7.5).fillColor(primaryColor).text("Paid via UPI", margin, curY, { align: "center", width: contentWidth });
                curY += 10;
                doc.image(qrBuffer, margin + (contentWidth - 60) / 2, curY, { width: 60 });
                curY += 65;
              }
            } catch (e) {}
          }

          doc.font("Outfit").fontSize(7).fillColor("#64748b").text(receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt.", margin, curY, { align: "center", width: contentWidth });
        }
        // =========================================================
        // 3. MINIMAL TEMPLATE (80mm) — SCREENSHOT 3
        // =========================================================
        else if (template === "Minimal") {
          let curY = margin;
          doc.font("Outfit-Bold").fontSize(11).fillColor("#000").text(receipt.shop?.name || "STORE", margin, curY, { align: "center", width: contentWidth });
          curY += 14;
          doc.font("Outfit").fontSize(7.5).fillColor("#555").text(`${receipt.shop?.phone || "-"} | GST: ${receipt.shop?.gstin || "-"}`, margin, curY, { align: "center", width: contentWidth });
          curY += 12;

          doc.strokeColor("#ccc").lineWidth(0.5).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
          curY += 4;

          doc.font("Outfit").fontSize(7.5).fillColor("#000").text(`Inv: ${receipt.invoiceNumber} ${receipt.date}`, margin, curY);
          curY += 10;

          doc.strokeColor("#ccc").lineWidth(0.5).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
          curY += 4;

          for (const item of (receipt.items || [])) {
            doc.text(`${item.qty}x ${item.name}`, margin, curY, { width: 140 });
            doc.text(formatInrPdf(item.lineTotal), margin + contentWidth - 50, curY, { align: "right", width: 50 });
            curY += 11;
          }

          doc.strokeColor("#ccc").lineWidth(0.5).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
          curY += 4;

          doc.font("Outfit-Bold").fontSize(9).fillColor("#000").text(`TOTAL:${formatInrPdf(receipt.grandTotal)}`, margin, curY);
          curY += 14;

          doc.font("Outfit").fontSize(7).fillColor("#666").text(`Paid via ${receipt.paymentMethod || "UPI"}`, margin, curY, { align: "center", width: contentWidth });
          curY += 10;
          doc.text(receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt.", margin, curY, { align: "center", width: contentWidth });
        }
        // =========================================================
        // 4. COMPACT TEMPLATE (58mm) — SCREENSHOT 11
        // =========================================================
        else if (template === "Compact") {
          let curY = margin;
          doc.font("Outfit-Bold").fontSize(9.5).fillColor("#000").text(receipt.shop?.name || "STORE", margin, curY, { align: "center", width: contentWidth });
          curY += 12;
          doc.font("Outfit").fontSize(6.5).fillColor("#444").text(`${receipt.shop?.phone || "-"} | GST:${receipt.shop?.gstin || "-"}`, margin, curY, { align: "center", width: contentWidth });
          curY += 10;

          doc.strokeColor("#000").lineWidth(0.5).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
          curY += 3;

          doc.font("Outfit").fontSize(6.5).fillColor("#000");
          doc.text(`INV: ${receipt.invoiceNumber}`, margin, curY);
          curY += 8;
          doc.text(`DAT: ${receipt.date} ${receipt.time}`, margin, curY);
          curY += 8;
          doc.text(`CUST: ${receipt.customer?.name || "Walk-in Custome"}`, margin, curY);
          curY += 9;

          doc.strokeColor("#000").lineWidth(0.5).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
          curY += 3;

          for (const item of (receipt.items || [])) {
            doc.text(`${item.qty}x ${item.name}`, margin, curY, { width: 105 });
            doc.text(formatInrPdf(item.lineTotal), margin + contentWidth - 40, curY, { align: "right", width: 40 });
            curY += 9;
          }

          doc.strokeColor("#000").lineWidth(0.5).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
          curY += 3;

          doc.font("Outfit").fontSize(6.5).fillColor("#000");
          doc.text("Sub / GST", margin, curY);
          doc.text(`${formatInrPdf(receipt.subtotal)} / ${formatInrPdf(receipt.gst)}`, margin + contentWidth - 65, curY, { align: "right", width: 65 });
          curY += 8;

          doc.text("Discount", margin, curY);
          doc.text(`-${formatInrPdf(receipt.discount)}`, margin + contentWidth - 40, curY, { align: "right", width: 40 });
          curY += 8;

          doc.font("Outfit-Bold").fontSize(8.5).fillColor("#000");
          doc.text("TOTAL", margin, curY);
          doc.text(formatInrPdf(receipt.grandTotal), margin + contentWidth - 50, curY, { align: "right", width: 50 });
          curY += 11;

          doc.strokeColor("#000").lineWidth(0.5).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
          curY += 3;

          doc.font("Outfit").fontSize(6).fillColor("#444").text(`Paid: ${receipt.paymentMethod || "UPI"}`, margin, curY, { align: "center", width: contentWidth });
          curY += 7;
          doc.text(receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt.", margin, curY, { align: "center", width: contentWidth });
        }
        // =========================================================
        // 5. CLASSIC / RETAIL / OTHER THERMAL TEMPLATES (80mm)
        // =========================================================
        else {
          let curY = margin;

          if (receipt.shop?.logo && receipt.shop.logo.startsWith("data:image/")) {
            try {
              const base64Data = receipt.shop.logo.split(",")[1];
              if (base64Data) {
                const logoBuffer = Buffer.from(base64Data, "base64");
                doc.image(logoBuffer, margin + (contentWidth - 36) / 2, curY, { fit: [36, 36] });
                curY += 38;
              }
            } catch (e) {}
          }

          doc.font("Outfit-Bold").fontSize(11).fillColor("#000").text((receipt.shop?.name || "STORE").toUpperCase(), margin, curY, { align: "center", width: contentWidth });
          curY += 14;
          doc.font("Outfit").fontSize(7.5).fillColor("#333").text(receipt.shop?.address || "", margin, curY, { align: "center", width: contentWidth });
          curY += 10;
          doc.text(`PH: ${receipt.shop?.phone || "-"}`, margin, curY, { align: "center", width: contentWidth });
          curY += 10;
          doc.text(`GSTIN: ${receipt.shop?.gstin || "-"}`, margin, curY, { align: "center", width: contentWidth });
          curY += 12;

          doc.strokeColor("#000").dash(3, { space: 2 }).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke().undash();
          curY += 5;

          doc.font("Outfit").fontSize(7.5).fillColor("#000");
          doc.text(`INV : ${receipt.invoiceNumber}`, margin, curY);
          curY += 9;
          doc.text(`DATE : ${receipt.date}`, margin, curY);
          curY += 9;
          doc.text(`TIME : ${receipt.time}`, margin, curY);
          curY += 9;
          doc.text(`CASH : ${receipt.cashier || "Admin"}`, margin, curY);
          curY += 9;
          doc.text(`CUST : ${receipt.customer?.name || "Walk-in Customer"}`, margin, curY);
          curY += 9;
          if (receipt.customer?.phone) {
            doc.text(`PHONE: +91 ${receipt.customer.phone}`, margin, curY);
            curY += 9;
          }

          doc.strokeColor("#000").dash(3, { space: 2 }).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke().undash();
          curY += 5;

          doc.font("Outfit-Bold").fontSize(7.5).fillColor("#000");
          doc.text("Item", margin, curY);
          doc.text("Total", margin + contentWidth - 45, curY, { align: "right", width: 45 });
          curY += 10;
          doc.strokeColor("#000").dash(3, { space: 2 }).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke().undash();
          curY += 4;

          doc.font("Outfit").fontSize(7.5).fillColor("#000");
          for (const item of (receipt.items || [])) {
            doc.text(`${item.qty}x ${item.name}`, margin, curY, { width: 145 });
            doc.text(formatInrPdf(item.lineTotal), margin + contentWidth - 45, curY, { align: "right", width: 45 });
            curY += 11;
          }

          doc.strokeColor("#000").dash(3, { space: 2 }).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke().undash();
          curY += 5;

          doc.font("Outfit").fontSize(7.5).fillColor("#000");
          doc.text("Subtotal", margin, curY);
          doc.text(formatInrPdf(receipt.subtotal), margin + contentWidth - 50, curY, { align: "right", width: 50 });
          curY += 10;

          doc.text("Discount", margin, curY);
          doc.text(`-${formatInrPdf(receipt.discount)}`, margin + contentWidth - 50, curY, { align: "right", width: 50 });
          curY += 10;

          doc.text("GST Tax", margin, curY);
          doc.text(formatInrPdf(receipt.gst), margin + contentWidth - 50, curY, { align: "right", width: 50 });
          curY += 12;

          doc.font("Outfit-Bold").fontSize(9.5).fillColor("#000");
          doc.text("GRAND TOTAL", margin, curY);
          doc.text(formatInrPdf(receipt.grandTotal), margin + contentWidth - 65, curY, { align: "right", width: 65 });
          curY += 14;

          doc.strokeColor("#000").dash(3, { space: 2 }).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke().undash();
          curY += 5;

          if (receipt.paymentMethod === "UPI" && receipt.upiQrCode) {
            try {
              const base64Data = receipt.upiQrCode.split(",")[1];
              if (base64Data) {
                const qrBuffer = Buffer.from(base64Data, "base64");
                doc.font("Outfit-Bold").fontSize(7.5).fillColor("#000").text("Paid via UPI", margin, curY, { align: "center", width: contentWidth });
                curY += 10;
                doc.image(qrBuffer, margin + (contentWidth - 65) / 2, curY, { width: 65 });
                curY += 70;
              }
            } catch (e) {}
          }

          doc.font("Outfit").fontSize(7).fillColor("#444").text(receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt.", margin, curY, { align: "center", width: contentWidth });
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
    return new Promise((resolve, reject) => {
      try {
        const PDFDocument = getPDFDocument();
        const doc = new PDFDocument({ size: "A4", margins: { top: 35, bottom: 35, left: 35, right: 35 }, bufferPages: true });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
        doc.on("error", (err: any) => reject(err));

        configurePdfFonts(doc);

        doc.rect(0, 0, 595.28, 8).fill("#1e3a8a");
        doc.font("Outfit-Bold").fontSize(18).fillColor("#1e3a8a").text("PURCHASE ORDER", 35, 25);
        doc.font("Outfit").fontSize(9).fillColor("#475569").text(`PO Number: ${purchase.po_number || purchase.poNumber || "PO-0001"}`, 35, 48);
        doc.text(`Supplier: ${purchase.supplier_name || purchase.supplierName || "Supplier"}`, 35, 60);
        doc.text(`Status: ${purchase.status || "COMPLETED"}`, 35, 72);

        doc.moveDown();
        doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(35, 90).lineTo(560.28, 90).stroke();

        let tableY = 105;
        doc.font("Outfit-Bold").fontSize(9).fillColor("#1e3a8a");
        doc.text("Item Name", 40, tableY);
        doc.text("Qty", 300, tableY, { width: 50, align: "right" });
        doc.text("Unit Cost", 360, tableY, { width: 80, align: "right" });
        doc.text("Total", 450, tableY, { width: 100, align: "right" });

        tableY += 15;
        doc.font("Outfit").fontSize(8.5).fillColor("#000");

        const items = purchase.items || [];
        for (const item of items) {
          doc.text(item.name || item.product_name || "Product", 40, tableY);
          doc.text(String(item.qty || item.quantity || 1), 300, tableY, { width: 50, align: "right" });
          doc.text(formatInrPdf(item.cost || item.unit_cost || 0), 360, tableY, { width: 80, align: "right" });
          doc.text(formatInrPdf(item.total || ((item.qty || 1) * (item.cost || 0))), 450, tableY, { width: 100, align: "right" });
          tableY += 14;
        }

        tableY += 10;
        doc.strokeColor("#1e3a8a").lineWidth(1).moveTo(35, tableY).lineTo(560.28, tableY).stroke();
        tableY += 8;

        doc.font("Outfit-Bold").fontSize(11).fillColor("#1e3a8a");
        doc.text("TOTAL AMOUNT:", 300, tableY);
        doc.text(formatInrPdf(purchase.total_amount || purchase.totalAmount || 0), 450, tableY, { width: 100, align: "right" });

        doc.end();
        stream.on("finish", () => resolve(outputPath));
        stream.on("error", (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }
}
