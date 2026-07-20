import { Request, Response, NextFunction } from "express";
import { ProfitService } from "../services/profit.service";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

export class ProfitController {
  private service = new ProfitService();

  private parseFilters(req: Request) {
    return {
      filter: req.query.filter ? String(req.query.filter) : "last30",
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      category: req.query.category ? String(req.query.category) : undefined,
      productId: req.query.productId ? parseInt(String(req.query.productId), 10) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : undefined,
    };
  }

  /** GET /api/profit/summary */
  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getSummary(this.parseFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/profit/dashboard — today + this month + last month */
  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getDashboardStats();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/profit/products */
  getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getProductProfitReport(this.parseFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/profit/sales */
  getSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getSaleProfitReport(this.parseFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/profit/trends */
  getTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = this.parseFilters(req);
      const [daily, monthly] = await Promise.all([
        this.service.getDailyTrend(filters),
        this.service.getMonthlyTrend(filters),
      ]);
      res.json({ success: true, data: { daily, monthly } });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/profit/reports — full report with top/bottom products */
  getFullReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getFullReport(this.parseFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/profit/export/excel */
  exportExcel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = this.parseFilters(req);
      const report = await this.service.getFullReport(filters);

      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["Metric", "Value (₹)"],
        ["Revenue", (report.summary.revenue / 100).toFixed(2)],
        ["Cost of Goods Sold (COGS)", (report.summary.cogs / 100).toFixed(2)],
        ["Gross Profit", (report.summary.grossProfit / 100).toFixed(2)],
        ["Gross Margin %", report.summary.grossMarginPercent.toFixed(2) + "%"],
        ["Units Sold", report.summary.unitsSold],
        ["Invoices", report.summary.invoiceCount],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

      // Products sheet
      const prodHeaders = ["Product", "SKU", "Category", "Units Sold", "Revenue (₹)", "COGS (₹)", "Gross Profit (₹)", "Margin %"];
      const prodRows = report.topProducts.map((p) => [
        p.name, p.sku, p.category || "",
        p.unitsSold,
        (p.revenue / 100).toFixed(2),
        (p.cogs / 100).toFixed(2),
        (p.grossProfit / 100).toFixed(2),
        p.grossMarginPercent.toFixed(2) + "%",
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]), "Products");

      // Trend sheet
      const trendHeaders = ["Period", "Revenue (₹)", "COGS (₹)", "Gross Profit (₹)", "Margin %"];
      const trendRows = report.monthlyTrend.map((t) => [
        t.label, t.revenue.toFixed(2), t.cogs.toFixed(2), t.grossProfit.toFixed(2), t.grossMarginPercent.toFixed(2) + "%"
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([trendHeaders, ...trendRows]), "Monthly Trend");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const todayStr = new Date().toISOString().substring(0, 10);
      res.setHeader("Content-Disposition", `attachment; filename="Profit-Report-${todayStr}.xlsx"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buf);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/profit/export/csv */
  exportCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.service.getFullReport(this.parseFilters(req));
      const rows = [
        ["Product", "SKU", "Category", "Units Sold", "Revenue", "COGS", "Gross Profit", "Margin %"],
        ...report.topProducts.map((p) => [
          `"${p.name}"`, `"${p.sku}"`, `"${p.category || ""}"`,
          p.unitsSold,
          (p.revenue / 100).toFixed(2),
          (p.cogs / 100).toFixed(2),
          (p.grossProfit / 100).toFixed(2),
          p.grossMarginPercent.toFixed(2),
        ]),
      ];
      const csv = rows.map((r) => r.join(",")).join("\n");
      const todayStr = new Date().toISOString().substring(0, 10);
      res.setHeader("Content-Disposition", `attachment; filename="Profit-Report-${todayStr}.csv"`);
      res.setHeader("Content-Type", "text/csv");
      res.send(csv);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/profit/export/pdf */
  exportPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.service.getFullReport(this.parseFilters(req));
      const { summary } = report;

      const path = require("path");
      const fs = require("fs");
      const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });

      const todayStr = new Date().toISOString().substring(0, 10);
      res.setHeader("Content-Disposition", `attachment; filename="Profit-Report-${todayStr}.pdf"`);
      res.setHeader("Content-Type", "application/pdf");
      doc.pipe(res);

      const regularFontPath = path.join(__dirname, "../assets/fonts/Outfit-Regular.ttf");
      const boldFontPath = path.join(__dirname, "../assets/fonts/Outfit-Bold.ttf");
      const hasOutfit = fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath);
      if (hasOutfit) {
        doc.registerFont("Outfit", regularFontPath);
        doc.registerFont("Outfit-Bold", boldFontPath);
      } else {
        doc.registerFont("Outfit", "Helvetica");
        doc.registerFont("Outfit-Bold", "Helvetica-Bold");
      }
      const Rs = hasOutfit ? "₹" : "Rs.";

      doc.font("Outfit-Bold").fontSize(20).fillColor("#0f172a").text("Orion POS — Profit & Margin Report", { align: "center" });
      doc.font("Outfit").fontSize(9).fillColor("#64748b").text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, { align: "center" });
      doc.moveDown(1.5);

      // Summary section
      doc.font("Outfit-Bold").fontSize(13).fillColor("#0f172a").text("Summary");
      doc.moveDown(0.5);
      const summaryRows = [
        ["Revenue", `${Rs} ${(summary.revenue / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
        ["Cost of Goods Sold", `${Rs} ${(summary.cogs / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
        ["Gross Profit", `${Rs} ${(summary.grossProfit / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
        ["Gross Margin %", `${summary.grossMarginPercent.toFixed(2)}%`],
        ["Units Sold", summary.unitsSold.toString()],
        ["Total Invoices", summary.invoiceCount.toString()],
      ];
      for (const [k, v] of summaryRows) {
        doc.font("Outfit").fontSize(10).fillColor("#334155").text(`${k}: `, { continued: true });
        doc.font("Outfit-Bold").fillColor("#0f172a").text(v);
      }
      doc.moveDown(1.5);

      // Top Products table
      doc.font("Outfit-Bold").fontSize(13).fillColor("#0f172a").text("Top Profitable Products");
      doc.moveDown(0.5);
      const colWidths = [160, 60, 80, 80, 80, 50];
      const headers = ["Product", "Units", "Revenue", "COGS", "Profit", "Margin"];
      let x = 50;
      doc.font("Outfit-Bold").fontSize(9).fillColor("#64748b");
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, doc.y, { width: colWidths[i], align: i > 0 ? "right" : "left" });
        x += colWidths[i];
      }
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").stroke();
      doc.moveDown(0.3);

      for (const p of report.topProducts.slice(0, 15)) {
        x = 50;
        doc.font("Outfit").fontSize(9).fillColor("#0f172a");
        const cells = [
          p.name.substring(0, 25),
          p.unitsSold.toString(),
          `${Rs} ${(p.revenue / 100).toFixed(0)}`,
          `${Rs} ${(p.cogs / 100).toFixed(0)}`,
          `${Rs} ${(p.grossProfit / 100).toFixed(0)}`,
          `${p.grossMarginPercent.toFixed(1)}%`,
        ];
        for (let i = 0; i < cells.length; i++) {
          doc.text(cells[i], x, doc.y, { width: colWidths[i], align: i > 0 ? "right" : "left" });
          x += colWidths[i];
        }
        doc.moveDown(0.2);
      }

      doc.end();
    } catch (err) {
      next(err);
    }
  };
}
