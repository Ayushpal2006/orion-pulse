import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import db from "../database/db";

export class PdfService {
  private getDbSetting(key: string, fallback: string): string {
    try {
      const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
      const row = stmt.get(key) as { value: string } | undefined;
      return row ? row.value : fallback;
    } catch (e) {
      return fallback;
    }
  }

  async generateInvoicePdf(receipt: any, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margin: 40 });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const signature = this.getDbSetting("signature", "Authorized Signatory");
        const exchangePolicy = this.getDbSetting("exchange_policy", "Items can be exchanged within 7 days in original condition.");
        const theme = this.getDbSetting("invoice_theme", "classic");
        const website = this.getDbSetting("business_website", "https://orionpos.in");

        // Primary Theme color
        let primaryColor = "#0f172a"; // classic slate
        if (theme === "clean") primaryColor = "#2563eb"; // blue
        if (theme === "dark") primaryColor = "#1e293b"; // charcoal

        // Title Block
        doc.font("Helvetica-Bold").fontSize(24).fillColor(primaryColor).text(receipt.shop.name, 40, 40);
        doc.font("Helvetica").fontSize(9).fillColor("#475569");
        doc.text(receipt.shop.address);
        doc.text(`Phone: ${receipt.shop.phone} | Email: ${receipt.shop.email || "billing@orionpos.in"} | GSTIN: ${receipt.shop.gstin}`);
        
        doc.moveDown(2);
        
        // Divider
        doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1.5);

        // Metadata columns (Left: Customer, Right: Invoice meta)
        const metaY = doc.y;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(primaryColor).text("BILL TO:", 40, metaY);
        doc.font("Helvetica").fillColor("#000000").text(receipt.customer.name, 40, metaY + 14);
        if (receipt.customer.phone) {
          doc.text(`Phone: +91 ${receipt.customer.phone}`, 40, metaY + 26);
        }

        doc.font("Helvetica-Bold").fillColor(primaryColor).text("INVOICE DETAILS:", 350, metaY);
        doc.font("Helvetica").fillColor("#000000").text(`Invoice Number: ${receipt.invoiceNumber}`, 350, metaY + 14);
        doc.text(`Date & Time: ${receipt.date} ${receipt.time}`, 350, metaY + 26);
        doc.text(`Cashier: ${receipt.cashier}`, 350, metaY + 38);

        doc.moveDown(4.5);

        // Table Header
        const tableY = doc.y;
        doc.rect(40, tableY - 6, 515, 20).fill("#f1f5f9");
        doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor);
        doc.text("Item Details", 45, tableY, { width: 180 });
        doc.text("Qty", 235, tableY, { width: 30, align: "right" });
        doc.text("Rate", 275, tableY, { width: 60, align: "right" });
        doc.text("Disc", 345, tableY, { width: 45, align: "right" });
        doc.text("GST", 400, tableY, { width: 45, align: "right" });
        doc.text("Total", 475, tableY, { width: 75, align: "right" });

        doc.moveDown(1);
        doc.font("Helvetica").fontSize(9).fillColor("#000000");

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
          doc.text(`Rs ${item.price.toFixed(2)}`, 275, rowY, { width: 60, align: "right" });
          doc.text(`${item.discount}%`, 345, rowY, { width: 45, align: "right" });
          doc.text(`${item.gst}%`, 400, rowY, { width: 45, align: "right" });
          doc.text(`Rs ${item.lineTotal.toFixed(2)}`, 475, rowY, { width: 75, align: "right" });
          doc.moveDown(0.9);
        }

        doc.moveDown(1);
        doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1.2);

        // Summary calculations block
        const totalsY = doc.y;
        doc.font("Helvetica").fontSize(9).fillColor("#475569");
        doc.text("Subtotal:", 350, totalsY);
        doc.text(`Rs ${receipt.subtotal.toFixed(2)}`, 475, totalsY, { align: "right", width: 75 });
        
        doc.text("Discount:", 350, totalsY + 14);
        doc.text(`Rs ${receipt.discount.toFixed(2)}`, 475, totalsY + 14, { align: "right", width: 75 });

        doc.text("GST Tax:", 350, totalsY + 28);
        doc.text(`Rs ${receipt.gst.toFixed(2)}`, 475, totalsY + 28, { align: "right", width: 75 });

        doc.rect(350, totalsY + 42, 205, 1).fill(primaryColor);

        doc.font("Helvetica-Bold").fontSize(11).fillColor(primaryColor).text("Grand Total:", 350, totalsY + 48);
        doc.text(`Rs ${receipt.grandTotal.toFixed(2)}`, 475, totalsY + 48, { align: "right", width: 75 });

        // Left side payment summary
        doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor).text("PAYMENT DETAILS", 40, totalsY);
        doc.font("Helvetica").fillColor("#000000").text(`Method: ${receipt.paymentMethod}`, 40, totalsY + 14);
        doc.text(`Status: Paid`, 40, totalsY + 26);
        if (receipt.paymentMethod === "UPI") {
          doc.text(`UPI payload: ${receipt.upiPayload.substring(0, 30)}...`, 40, totalsY + 38);
        }

        // Terms and Signature block
        doc.moveDown(5);
        const policyY = doc.y > 620 ? 620 : doc.y;
        
        doc.font("Helvetica-Bold").fontSize(8).fillColor(primaryColor).text("EXCHANGE POLICY:", 40, policyY);
        doc.font("Helvetica").fillColor("#475569").text(exchangePolicy, 40, policyY + 12, { width: 250 });
        doc.text(`Visit website: ${website}`, 40, policyY + 40);

        doc.font("Helvetica-Bold").fillColor(primaryColor).text("FOR ORION POS", 380, policyY, { align: "center", width: 175 });
        doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(signature, 380, policyY + 35, { align: "center", width: 175 });
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(380, policyY + 32).lineTo(555, policyY + 32).stroke();

        // Footer note
        doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor).text(receipt.thankYouMessage, 40, 750, { align: "center", width: 515 });
        doc.font("Helvetica").fontSize(7).fillColor("#94a3b8").text("Generated automatically via Orion POS sharing ecosystem.", 40, 762, { align: "center", width: 515 });

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
