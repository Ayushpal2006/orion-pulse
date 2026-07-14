import { Request, Response, NextFunction } from "express";
import { ReportsService } from "../services/reports.service";
import { productRepository, customerRepository, saleRepository } from "../repositories";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

export class ReportsController {
  private service: ReportsService;
  private productRepo = productRepository;
  private customerRepo = customerRepository;
  private saleRepo = saleRepository;

  constructor() {
    this.service = new ReportsService();
  }

  getReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = String(req.query.filter || "last7");
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const data = await this.service.getReportsData(filter, startDate, endDate);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error("❌ Reports Generation Failed. Original SQL Error Details:", error);
      next(error);
    }
  };

  exportPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = String(req.query.filter || "last7");
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const data = await this.service.getReportsData(filter, startDate, endDate);
      const todayStr = new Date().toISOString().substring(0, 10);
      const filename = `Report-${todayStr}.pdf`;

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/pdf");

      const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
      doc.pipe(res);

      const path = require("path");
      const fs = require("fs");
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
      const kolkataTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      // --- PDF Drawing ---
      // Header
      doc.fontSize(22).font("Outfit-Bold").fillColor("#0f172a").text("Orion POS - Business Report", { align: "center" });
      doc.fontSize(9).font("Outfit").fillColor("#64748b").text(`Generated: ${kolkataTime} (Asia/Kolkata)`, { align: "center" });
      
      const periodText = filter === "custom" && startDate 
        ? `Period: ${startDate} to ${endDate || startDate}`
        : `Period / Filter: ${filter.toUpperCase()}`;
      doc.text(periodText, { align: "center" });
      doc.moveDown(1.5);

      // Double divider line
      doc.strokeColor("#e2e8f0").lineWidth(1.5).moveTo(50, 110).lineTo(545, 110).stroke();

      // KPI Cards
      const cardY = 125;
      const cardWidth = 108;
      const cardHeight = 60;
      const cardGap = 11;

      const cards = [
        { label: "TOTAL REVENUE", value: `${currencySymbol} ${data.revenue.toFixed(2)}` },
        { label: "TOTAL ORDERS", value: `${data.orders}` },
        { label: "GROSS PROFIT", value: `${currencySymbol} ${data.profit.toFixed(2)}` },
        { label: "AVERAGE TICKET", value: `${currencySymbol} ${data.averageOrderValue.toFixed(2)}` }
      ];

      cards.forEach((c, idx) => {
        const x = 50 + idx * (cardWidth + cardGap);
        // Draw background card box
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 6).fillColor("#f8fafc").fill();
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 6).strokeColor("#e2e8f0").lineWidth(1).stroke();
        
        // Print Card Text
        doc.fillColor("#64748b").font("Outfit-Bold").fontSize(7).text(c.label, x + 8, cardY + 12, { width: cardWidth - 16, align: "center" });
        doc.fillColor("#0f172a").font("Outfit-Bold").fontSize(11).text(c.value, x + 4, cardY + 28, { width: cardWidth - 8, align: "center" });
      });

      let currentY = 205;

      const checkPageBounds = (heightNeeded: number) => {
        if (currentY + heightNeeded > 750) {
          doc.addPage();
          currentY = 50;
        }
      };

      const drawSectionHeader = (title: string) => {
        checkPageBounds(40);
        doc.rect(50, currentY, 4, 16).fillColor("#0f172a").fill();
        doc.fillColor("#0f172a").font("Outfit-Bold").fontSize(12).text(title, 60, currentY + 2);
        doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(50, currentY + 20).lineTo(545, currentY + 20).stroke();
        currentY += 28;
      };

      // 1. Top Selling Products
      drawSectionHeader("Top Selling Products");
      
      // Table Header
      doc.rect(50, currentY, 495, 18).fillColor("#f1f5f9").fill();
      doc.fillColor("#475569").font("Outfit-Bold").fontSize(8.5);
      doc.text("Product Name", 58, currentY + 4);
      doc.text("Units Sold", 320, currentY + 4, { width: 80, align: "right" });
      doc.text("Revenue", 430, currentY + 4, { width: 100, align: "right" });
      currentY += 18;

      if (data.topProducts.length === 0) {
        doc.fillColor("#64748b").font("Outfit").fontSize(9).text("No product sales logs found.", 58, currentY + 6);
        currentY += 25;
      } else {
        data.topProducts.slice(0, 5).forEach((p: any, idx: number) => {
          checkPageBounds(22);
          if (idx % 2 === 1) {
            doc.rect(50, currentY, 495, 20).fillColor("#f8fafc").fill();
          }
          doc.fillColor("#334155").font("Outfit").fontSize(9);
          doc.text(p.name, 58, currentY + 5);
          doc.text(String(p.unitsSold), 320, currentY + 5, { width: 80, align: "right" });
          doc.text(`${currencySymbol} ${p.revenue.toFixed(2)}`, 430, currentY + 5, { width: 100, align: "right" });
          currentY += 20;
        });
        currentY += 8;
      }

      // 2. Top Spender Customers
      drawSectionHeader("Top Spender Customers");

      // Table Header
      doc.rect(50, currentY, 495, 18).fillColor("#f1f5f9").fill();
      doc.fillColor("#475569").font("Outfit-Bold").fontSize(8.5);
      doc.text("Customer Name", 58, currentY + 4);
      doc.text("Phone", 220, currentY + 4);
      doc.text("Orders Count", 320, currentY + 4, { width: 80, align: "right" });
      doc.text("Total Spend", 430, currentY + 4, { width: 100, align: "right" });
      currentY += 18;

      if (data.topCustomers.length === 0) {
        doc.fillColor("#64748b").font("Outfit").fontSize(9).text("No customer spends found.", 58, currentY + 6);
        currentY += 25;
      } else {
        data.topCustomers.forEach((c: any, idx: number) => {
          checkPageBounds(22);
          if (idx % 2 === 1) {
            doc.rect(50, currentY, 495, 20).fillColor("#f8fafc").fill();
          }
          doc.fillColor("#334155").font("Outfit").fontSize(9);
          doc.text(c.name, 58, currentY + 5);
          doc.text(c.phone, 220, currentY + 5);
          doc.text(String(c.orders), 320, currentY + 5, { width: 80, align: "right" });
          doc.text(`${currencySymbol} ${c.spend.toFixed(2)}`, 430, currentY + 5, { width: 100, align: "right" });
          currentY += 20;
        });
        currentY += 8;
      }

      // 3. GST Breakdown Summary
      drawSectionHeader("GST Breakdown Summary");

      // Table Header
      doc.rect(50, currentY, 495, 18).fillColor("#f1f5f9").fill();
      doc.fillColor("#475569").font("Outfit-Bold").fontSize(8.5);
      doc.text("GST Slab", 58, currentY + 4);
      doc.text("Taxable Value", 220, currentY + 4, { width: 140, align: "right" });
      doc.text("Tax Collected", 390, currentY + 4, { width: 140, align: "right" });
      currentY += 18;

      if (data.gstSummary.length === 0) {
        doc.fillColor("#64748b").font("Outfit").fontSize(9).text("No GST logs found in this period.", 58, currentY + 6);
        currentY += 25;
      } else {
        let totalTaxable = 0;
        let totalTax = 0;

        data.gstSummary.forEach((g: any, idx: number) => {
          checkPageBounds(22);
          totalTaxable += g.taxable;
          totalTax += g.tax;

          if (idx % 2 === 1) {
            doc.rect(50, currentY, 495, 20).fillColor("#f8fafc").fill();
          }
          doc.fillColor("#334155").font("Outfit").fontSize(9);
          doc.text(`GST ${g.slab}`, 58, currentY + 5);
          doc.text(`${currencySymbol} ${g.taxable.toFixed(2)}`, 220, currentY + 5, { width: 140, align: "right" });
          doc.text(`${currencySymbol} ${g.tax.toFixed(2)}`, 390, currentY + 5, { width: 140, align: "right" });
          currentY += 20;
        });

        // Totals Row
        checkPageBounds(22);
        doc.rect(50, currentY, 495, 20).fillColor("#f1f5f9").fill();
        doc.fillColor("#0f172a").font("Outfit-Bold").fontSize(9);
        doc.text("Total", 58, currentY + 5);
        doc.text(`${currencySymbol} ${totalTaxable.toFixed(2)}`, 220, currentY + 5, { width: 140, align: "right" });
        doc.text(`${currencySymbol} ${totalTax.toFixed(2)}`, 390, currentY + 5, { width: 140, align: "right" });
        currentY += 20;
      }

      // Add dynamic footer page numbers
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(50, 770).lineTo(545, 770).stroke();
        doc.fontSize(7.5).font("Outfit").fillColor("#94a3b8");
        doc.text("End of generated report. Orion POS system · Protected by Local Database Ledger.", 50, 778, { align: "left", width: 350 });
        doc.text(`Page ${i + 1} of ${range.count}`, 450, 778, { align: "right", width: 95 });
      }

      doc.end();
    } catch (error) {
      next(error);
    }
  };

  exportExcel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = String(req.query.filter || "last7");
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const data = await this.service.getReportsData(filter, startDate, endDate);
      const todayStr = new Date().toISOString().substring(0, 10);
      const filename = `Report-${todayStr}.xlsx`;

      // 1. Fetch Sales list in selected period
      const salesRows = await this.saleRepo.getSalesExport(filter, startDate, endDate);

      // 2. Fetch Active Customers
      const customersRows = await this.customerRepo.getCustomersExport();

      // 3. Fetch Active Products
      const productsRows = await this.productRepo.getProductsExport();

      // 4. GST Summary Sheet
      const gstSheetRows = data.gstSummary.map((g: any) => ({
        GST_Slab: g.slab,
        Taxable_Value_INR: g.taxable,
        Tax_Collected_INR: g.tax
      }));

      // 5. Payment Summary Sheet
      const paymentSheetRows = Object.entries(data.paymentMethodSplit || {}).map(([method, amount]) => ({
        Payment_Method: method,
        Total_Amount_INR: amount
      }));

      // Create Excel Workbook using sheetjs (xlsx)
      const wb = XLSX.utils.book_new();

      const wsSales = XLSX.utils.json_to_sheet(salesRows);
      XLSX.utils.book_append_sheet(wb, wsSales, "Sales");

      const wsCustomers = XLSX.utils.json_to_sheet(customersRows);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Customers");

      const wsProducts = XLSX.utils.json_to_sheet(productsRows);
      XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

      const wsGst = XLSX.utils.json_to_sheet(gstSheetRows);
      XLSX.utils.book_append_sheet(wb, wsGst, "GST Summary");

      const wsPayment = XLSX.utils.json_to_sheet(paymentSheetRows);
      XLSX.utils.book_append_sheet(wb, wsPayment, "Payment Summary");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.status(200).send(buf);
    } catch (error) {
      next(error);
    }
  };
}

