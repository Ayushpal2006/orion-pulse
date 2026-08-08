import fs from "fs";
import path from "path";
import QRCode from "qrcode";
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
    const signature = receipt.branding?.signature || receipt.signature || "Authorized Signatory";
    const dbPrimaryColor = receipt.branding?.primaryColor || "";
    const pdfTemplate = receipt.branding?.pdfTemplate || receipt.pdfTemplate || "Professional A4";
    const termsAndConditions = receipt.branding?.termsAndConditions ?? receipt.termsAndConditions ?? "";

    return new Promise(async (resolve, reject) => {
      try {
        const PDFDocument = getPDFDocument();

        // Standard A4 dimensions in PDF points: 595.28 x 841.89 pt
        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 35, bottom: 15, left: 35, right: 35 },
          bufferPages: true,
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
        doc.on("error", (err: any) => reject(err));

        configurePdfFonts(doc);

        const primaryColor =
          dbPrimaryColor ||
          (pdfTemplate === "GST Invoice A4"
            ? "#047857"
            : pdfTemplate === "Standard A4"
            ? "#1e40af"
            : "#0f172a");
        const secondaryColor = "#475569";
        const margin = 35;
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const contentWidth = pageWidth - 2 * margin; // 525.28 pt

        let curY = margin;

        // -------------------------------------------------------------
        // HEADER BAR / LOGO & STORE INFO
        // -------------------------------------------------------------
        doc.rect(margin, curY, contentWidth, 4).fill(primaryColor);
        curY += 12;

        const headerTopY = curY;

        // Left Side: Logo & Business Info
        let leftX = margin;
        if (receipt.shop?.logo && typeof receipt.shop.logo === "string") {
          try {
            let logoBuffer: Buffer | null = null;
            if (receipt.shop.logo.startsWith("data:image/")) {
              const base64Data = receipt.shop.logo.split(",")[1];
              if (base64Data) logoBuffer = Buffer.from(base64Data, "base64");
            } else {
              const cleanPath = receipt.shop.logo.replace(/^\//, "");
              const candidatePaths = [
                path.resolve(process.cwd(), cleanPath),
                path.resolve(process.cwd(), "uploads", path.basename(cleanPath)),
                path.resolve(process.cwd(), "storage/uploads", path.basename(cleanPath)),
              ];
              for (const p of candidatePaths) {
                if (fs.existsSync(p)) {
                  logoBuffer = fs.readFileSync(p);
                  break;
                }
              }
            }
            if (logoBuffer) {
              doc.image(logoBuffer, leftX, curY, { fit: [55, 55] });
              leftX += 65;
            }
          } catch (e) {
            console.error("Failed to render store logo in A4 PDF:", e);
          }
        }

        const rightWidth = 190;
        const rightX = margin + contentWidth - rightWidth; // 370.28 pt
        const maxLeftWidth = rightX - leftX - 15;

        const storeName = (receipt.shop?.name || "STORE INVOICE").toUpperCase();
        doc.font("Outfit-Bold").fontSize(14).fillColor(primaryColor).text(storeName, leftX, curY, { width: maxLeftWidth });
        const storeNameHeight = doc.heightOfString(storeName, { width: maxLeftWidth });
        let storeInfoY = curY + storeNameHeight + 3;

        doc.font("Outfit").fontSize(8.5).fillColor(secondaryColor);
        if (receipt.shop?.address) {
          doc.text(receipt.shop.address, leftX, storeInfoY, { width: maxLeftWidth });
          storeInfoY += doc.heightOfString(receipt.shop.address, { width: maxLeftWidth }) + 2;
        }

        const contactLine = [
          receipt.shop?.phone ? `Phone: ${receipt.shop.phone}` : "",
          receipt.shop?.email ? `Email: ${receipt.shop.email}` : "",
        ]
          .filter(Boolean)
          .join("  |  ");

        if (contactLine) {
          doc.text(contactLine, leftX, storeInfoY, { width: maxLeftWidth });
          storeInfoY += 12;
        }

        if (receipt.shop?.gstin) {
          doc.font("Outfit-Bold").fontSize(8.5).fillColor(primaryColor).text(`GSTIN: ${receipt.shop.gstin}`, leftX, storeInfoY, { width: maxLeftWidth });
          storeInfoY += 14;
        }

        // Right Side: Tax Invoice Badge & Key Invoice Metadata
        const badgeTitle = pdfTemplate === "GST Invoice A4" ? "GST TAX INVOICE" : "TAX INVOICE";
        doc.rect(rightX, headerTopY, rightWidth, 24).fill(primaryColor);
        doc.font("Outfit-Bold").fontSize(11).fillColor("#ffffff").text(badgeTitle, rightX, headerTopY + 6, { align: "center", width: rightWidth });

        let invMetaY = headerTopY + 30;
        doc.font("Outfit-Bold").fontSize(9.5).fillColor("#000000").text(`Invoice #: ${receipt.invoiceNumber}`, rightX, invMetaY, { align: "right", width: rightWidth });
        invMetaY += 14;
        doc.font("Outfit").fontSize(8.5).fillColor(secondaryColor).text(`Date: ${receipt.date} ${receipt.time}`, rightX, invMetaY, { align: "right", width: rightWidth });
        invMetaY += 12;
        doc.text(`Payment: ${receipt.paymentMethod || "CASH"}`, rightX, invMetaY, { align: "right", width: rightWidth });
        invMetaY += 12;
        if (receipt.status) {
          doc.font("Outfit-Bold").fontSize(8.5).fillColor(receipt.status === "VOID" ? "#dc2626" : "#166534").text(`Status: ${receipt.status}`, rightX, invMetaY, { align: "right", width: rightWidth });
          invMetaY += 14;
        }

        curY = Math.max(storeInfoY, invMetaY) + 10;

        // Divider Line
        doc.strokeColor("#cbd5e1").lineWidth(0.8).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
        curY += 12;

        // -------------------------------------------------------------
        // CUSTOMER & INVOICE DETAILS 2-COLUMN GRID
        // -------------------------------------------------------------
        const colW = (contentWidth - 15) / 2; // 255.14 pt
        const col1X = margin;
        const col2X = margin + colW + 15;

        // Calculate dynamic height for customer & invoice info boxes
        let custInnerHeight = 22; // header height (16) + padding (6)
        doc.font("Outfit-Bold").fontSize(8.5);
        custInnerHeight += doc.heightOfString(receipt.customer?.name || "Walk-in Customer", { width: colW - 16 }) + 2;
        doc.font("Outfit").fontSize(8);
        if (receipt.customer?.phone) {
          custInnerHeight += 11;
        }
        if (receipt.customer?.address) {
          custInnerHeight += doc.heightOfString(`Address: ${receipt.customer.address}`, { width: colW - 16 }) + 2;
        }
        if (receipt.customer?.gstin) {
          custInnerHeight += 11;
        }
        custInnerHeight += 8;

        const infoInnerHeight = 22 + 11 + 11 + 11 + (receipt.status ? 14 : 0) + 8;
        const custBoxHeight = Math.max(68, custInnerHeight, infoInnerHeight);

        // Column 1: Billed To / Customer
        doc.rect(col1X, curY, colW, custBoxHeight).strokeColor("#cbd5e1").lineWidth(1).stroke();
        doc.rect(col1X, curY, colW, 16).fill(primaryColor);
        doc.font("Outfit-Bold").fontSize(8.5).fillColor("#ffffff").text("BILLED TO / CUSTOMER", col1X + 8, curY + 4);

        let custY = curY + 22;
        doc.font("Outfit-Bold").fontSize(8.5).fillColor("#000000").text(receipt.customer?.name || "Walk-in Customer", col1X + 8, custY, { width: colW - 16 });
        custY += doc.heightOfString(receipt.customer?.name || "Walk-in Customer", { width: colW - 16 }) + 2;
        doc.font("Outfit").fontSize(8).fillColor(secondaryColor);
        if (receipt.customer?.phone) {
          doc.text(`Phone: ${receipt.customer.phone}`, col1X + 8, custY, { width: colW - 16 });
          custY += 11;
        }
        if (receipt.customer?.address) {
          doc.text(`Address: ${receipt.customer.address}`, col1X + 8, custY, { width: colW - 16 });
          custY += doc.heightOfString(`Address: ${receipt.customer.address}`, { width: colW - 16 }) + 2;
        }
        if (receipt.customer?.gstin) {
          doc.text(`GSTIN: ${receipt.customer.gstin}`, col1X + 8, custY, { width: colW - 16 });
        }

        // Column 2: Invoice Info & Cashier
        doc.rect(col2X, curY, colW, custBoxHeight).strokeColor("#cbd5e1").lineWidth(1).stroke();
        doc.rect(col2X, curY, colW, 16).fill(primaryColor);
        doc.font("Outfit-Bold").fontSize(8.5).fillColor("#ffffff").text("INVOICE DETAILS", col2X + 8, curY + 4);

        let infoY = curY + 22;
        doc.font("Outfit").fontSize(8).fillColor("#000000");
        doc.text(`Invoice No: ${receipt.invoiceNumber}`, col2X + 8, infoY);
        infoY += 11;
        doc.text(`Date & Time: ${receipt.date} ${receipt.time}`, col2X + 8, infoY);
        infoY += 11;
        doc.text(`Cashier / User: ${receipt.cashier || "Admin"}`, col2X + 8, infoY);
        infoY += 11;
        doc.text(`Payment Mode: ${receipt.paymentMethod || "CASH"}`, col2X + 8, infoY);

        curY += custBoxHeight + 12;

        // -------------------------------------------------------------
        // ITEM TABLE WITH MULTI-PAGE & HEADER REPEATING SUPPORT
        // -------------------------------------------------------------
        const drawTableHeader = (y: number) => {
          doc.rect(margin, y, contentWidth, 20).fill(primaryColor);
          doc.font("Outfit-Bold").fontSize(8.5).fillColor("#ffffff");
          doc.text("#", margin + 4, y + 5, { width: 18, align: "left" });
          doc.text("Item Description", margin + 24, y + 5, { width: 180, align: "left" });
          doc.text("Qty", margin + 206, y + 5, { width: 32, align: "center" });
          doc.text("Rate", margin + 240, y + 5, { width: 55, align: "right" });
          doc.text("Discount", margin + 298, y + 5, { width: 50, align: "right" });
          doc.text("GST %", margin + 350, y + 5, { width: 38, align: "right" });
          doc.text("Tax Amt", margin + 390, y + 5, { width: 55, align: "right" });
          doc.text("Total", margin + 448, y + 5, { width: 72, align: "right" });
          return y + 20;
        };

        curY = drawTableHeader(curY);

        const items = receipt.items || [];
        let rIndex = 0;

        for (const item of items) {
          const nameStr = item.name || "Product Item";
          doc.font("Outfit").fontSize(8.5);
          const nameHeight = doc.heightOfString(nameStr, { width: 180 });
          const rowHeight = Math.max(18, nameHeight + 6);

          // Page Overflow Check
          if (curY + rowHeight > pageHeight - 120) {
            doc.font("Outfit").fontSize(7.5).fillColor(secondaryColor).text("Continued on next page...", margin, pageHeight - 30, { align: "right", width: contentWidth });
            doc.addPage();
            curY = margin;
            doc.rect(margin, curY, contentWidth, 3).fill(primaryColor);
            curY += 8;
            curY = drawTableHeader(curY);
          }

          // Alternating row background
          if (rIndex % 2 === 1) {
            doc.rect(margin, curY, contentWidth, rowHeight).fill("#f8fafc");
          }

          const gstPct = Number(item.gst) || 0;
          const lineTot = Number(item.lineTotal) || 0;
          const taxAmt = gstPct > 0 ? (lineTot * (gstPct / (100 + gstPct))) : 0;

          doc.font("Outfit").fontSize(8.5).fillColor("#000000");
          doc.text(String(rIndex + 1), margin + 4, curY + 4, { width: 18, align: "left" });
          doc.text(nameStr, margin + 24, curY + 4, { width: 180, align: "left" });
          doc.text(String(item.qty || 1), margin + 206, curY + 4, { width: 32, align: "center" });
          doc.text(formatInrPdf(item.price), margin + 240, curY + 4, { width: 55, align: "right" });
          doc.text(item.discount ? formatInrPdf(item.discount) : "-", margin + 298, curY + 4, { width: 50, align: "right" });
          doc.text(`${gstPct}%`, margin + 350, curY + 4, { width: 38, align: "right" });
          doc.text(taxAmt > 0 ? formatInrPdf(taxAmt) : "-", margin + 390, curY + 4, { width: 55, align: "right" });
          doc.text(formatInrPdf(lineTot), margin + 448, curY + 4, { width: 72, align: "right" });

          curY += rowHeight;
          doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(margin, curY).lineTo(margin + contentWidth, curY).stroke();
          rIndex++;
        }

        curY += 12;

        // Page Overflow Check before rendering totals summary block
        if (curY + 150 > pageHeight - 40) {
          doc.addPage();
          curY = margin + 10;
        }

        // -------------------------------------------------------------
        // TAX SUMMARY & GRAND TOTALS SECTION
        // -------------------------------------------------------------
        const sumBoxW = (contentWidth - 15) / 2; // 255.14 pt
        const leftSumX = margin;
        const rightSumX = margin + sumBoxW + 15;

        // Left Summary: Tax & Policy Info
        doc.rect(leftSumX, curY, sumBoxW, 75).strokeColor("#cbd5e1").lineWidth(1).stroke();
        doc.font("Outfit-Bold").fontSize(8.5).fillColor(primaryColor).text("TAX BREAKDOWN & NOTES", leftSumX + 8, curY + 6);
        doc.font("Outfit").fontSize(8).fillColor("#000000");
        const taxableAmt = (receipt.subtotal || 0) - (receipt.discount || 0);
        doc.text(`Taxable Value: ${formatInrPdf(taxableAmt)}`, leftSumX + 8, curY + 20);
        doc.text(`CGST + SGST (GST): ${formatInrPdf(receipt.gst || 0)}`, leftSumX + 8, curY + 32);
        doc.font("Outfit").fontSize(7.5).fillColor(secondaryColor).text("Tax Invoice issued under Applicable GST Rules.", leftSumX + 8, curY + 46);
        if (termsAndConditions) {
          doc.text(termsAndConditions, leftSumX + 8, curY + 57, { width: sumBoxW - 16, height: 14, ellipsis: true });
        }

        // Right Summary: Amounts Breakdown
        doc.rect(rightSumX, curY, sumBoxW, 75).fillAndStroke("#f8fafc", "#cbd5e1");

        let sumY = curY + 6;
        doc.font("Outfit").fontSize(8).fillColor("#000000").text("Subtotal:", rightSumX + 8, sumY);
        doc.text(formatInrPdf(receipt.subtotal || 0), rightSumX + sumBoxW - 95, sumY, { align: "right", width: 85 });
        sumY += 13;

        doc.fillColor("#dc2626").text("Discount:", rightSumX + 8, sumY);
        doc.text(`-${formatInrPdf(receipt.discount || 0)}`, rightSumX + sumBoxW - 95, sumY, { align: "right", width: 85 });
        sumY += 13;

        doc.fillColor("#000000").text("GST Tax:", rightSumX + 8, sumY);
        doc.text(formatInrPdf(receipt.gst || 0), rightSumX + sumBoxW - 95, sumY, { align: "right", width: 85 });
        sumY += 15;

        // Grand Total Highlight Bar
        doc.rect(rightSumX, sumY, sumBoxW, 25).fillAndStroke("#f0fdf4", primaryColor);
        doc.font("Outfit-Bold").fontSize(10).fillColor(primaryColor).text("GRAND TOTAL:", rightSumX + 8, sumY + 7);
        doc.text(formatInrPdf(receipt.grandTotal || 0), rightSumX + sumBoxW - 105, sumY + 7, { align: "right", width: 95 });

        curY += 88;

        // -------------------------------------------------------------
        // QR CODE, SIGNATORY & FOOTER SECTION
        // -------------------------------------------------------------
        if (curY + 70 > pageHeight - 30) {
          doc.addPage();
          curY = margin + 10;
        }

        const footLeftX = margin;
        const footRightX = margin + contentWidth - 180;

        // UPI QR Code
        if (receipt.paymentMethod === "UPI" && (receipt.upiQrCode || receipt.upiPayload)) {
          try {
            let qrBuffer: Buffer | null = null;
            if (receipt.upiQrCode && receipt.upiQrCode.startsWith("data:image/")) {
              const base64Data = receipt.upiQrCode.split(",")[1];
              if (base64Data) qrBuffer = Buffer.from(base64Data, "base64");
            } else if (receipt.upiPayload) {
              qrBuffer = await QRCode.toBuffer(receipt.upiPayload, { margin: 1, width: 120 });
            }
            if (qrBuffer) {
              doc.image(qrBuffer, footLeftX, curY, { width: 55 });
              doc.font("Outfit-Bold").fontSize(7.5).fillColor(primaryColor).text("Scan to Pay via UPI", footLeftX, curY + 58);
            }
          } catch (e) {
            console.error("Failed to draw UPI QR in A4 PDF:", e);
          }
        }

        // Signature Box
        doc.font("Outfit-Bold").fontSize(8.5).fillColor(primaryColor).text(`FOR ${(receipt.shop?.name || "STORE").toUpperCase()}`, footRightX, curY, { align: "right", width: 180 });
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(footRightX + 20, curY + 42).lineTo(footRightX + 180, curY + 42).stroke();
        doc.font("Outfit").fontSize(7.5).fillColor(secondaryColor).text(signature || "Authorized Signatory", footRightX, curY + 46, { align: "right", width: 180 });

        // Temporarily clear bottom margin so footer text does not auto-trigger new pages
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        // Thank you footer line across bottom
        const footerY = pageHeight - 32;
        doc.font("Outfit").fontSize(7.5).fillColor(secondaryColor).text(receipt.thankYouMessage || "Thank you for your business!", margin, footerY, { align: "center", width: contentWidth, lineBreak: false });

        // Page Numbering Loop (Page X of Y)
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.font("Outfit").fontSize(7).fillColor("#94a3b8").text(`Page ${i + 1} of ${pages.count}`, margin + contentWidth - 70, pageHeight - 20, { align: "right", width: 70, lineBreak: false });
        }

        doc.page.margins.bottom = oldBottomMargin;

        doc.end();
        stream.on("finish", () => resolve(outputPath));
        stream.on("error", (err: any) => reject(err));
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
