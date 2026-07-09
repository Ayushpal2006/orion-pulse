import { Request, Response, NextFunction } from "express";
import { ReportsService } from "../services/reports.service";
import { ReportsRepository } from "../repositories/reports.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { ProductRepository } from "../repositories/product.repository";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import db from "../database/db";

export class ReportsController {
  private service: ReportsService;
  private reportsRepo: ReportsRepository;
  private customerRepo: CustomerRepository;
  private productRepo: ProductRepository;

  constructor() {
    this.service = new ReportsService();
    this.reportsRepo = new ReportsRepository();
    this.customerRepo = new CustomerRepository();
    this.productRepo = new ProductRepository();
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
    } catch (error) {
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

      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.pipe(res);

      // --- PDF Drawing ---
      // Header
      doc.fontSize(22).font("Helvetica-Bold").text("Orion POS - Business Report", { align: "center" });
      doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString("en-IN")}`, { align: "center" });
      doc.text(`Period / Filter: ${filter.toUpperCase()} ${startDate ? `(${startDate} to ${endDate || startDate})` : ""}`, { align: "center" });
      doc.moveDown(1.5);

      // KPI Summary Section
      doc.fontSize(14).font("Helvetica-Bold").text("Executive Summary");
      doc.rect(40, doc.y + 5, 515, 1).fill("#e5e7eb");
      doc.moveDown(1);

      const yStart = doc.y;
      doc.fontSize(10).font("Helvetica-Bold").text("Total Revenue", 50, yStart);
      doc.font("Helvetica").text(`INR ${data.revenue.toFixed(2)}`, 50, yStart + 15);

      doc.font("Helvetica-Bold").text("Total Orders", 180, yStart);
      doc.font("Helvetica").text(`${data.orders}`, 180, yStart + 15);

      doc.font("Helvetica-Bold").text("Gross Profit", 310, yStart);
      doc.font("Helvetica").text(`INR ${data.profit.toFixed(2)}`, 310, yStart + 15);

      doc.font("Helvetica-Bold").text("Average Ticket", 440, yStart);
      doc.font("Helvetica").text(`INR ${data.averageOrderValue.toFixed(2)}`, 440, yStart + 15);

      doc.y = yStart + 40;
      doc.moveDown(2);

      // Top Products Table
      doc.fontSize(14).font("Helvetica-Bold").text("Top 5 Selling Products", 40);
      doc.rect(40, doc.y + 5, 515, 1).fill("#e5e7eb");
      doc.moveDown(1);
      
      let pY = doc.y;
      doc.fontSize(9).font("Helvetica-Bold").text("Product Name", 50, pY);
      doc.text("Units Sold", 300, pY, { width: 80, align: "right" });
      doc.text("Revenue", 420, pY, { width: 100, align: "right" });
      
      doc.font("Helvetica");
      data.topProducts.slice(0, 5).forEach((p: any) => {
        pY += 18;
        doc.text(p.name, 50, pY);
        doc.text(String(p.unitsSold), 300, pY, { width: 80, align: "right" });
        doc.text(`INR ${p.revenue.toFixed(2)}`, 420, pY, { width: 100, align: "right" });
      });

      doc.y = pY + 25;
      doc.moveDown(1.5);

      // Top Customers Table
      doc.fontSize(14).font("Helvetica-Bold").text("Top Spender Customers", 40);
      doc.rect(40, doc.y + 5, 515, 1).fill("#e5e7eb");
      doc.moveDown(1);

      let cY = doc.y;
      doc.fontSize(9).font("Helvetica-Bold").text("Customer Name", 50, cY);
      doc.text("Phone", 220, cY);
      doc.text("Orders Count", 330, cY, { width: 80, align: "right" });
      doc.text("Total Spend", 440, cY, { width: 80, align: "right" });

      doc.font("Helvetica");
      data.topCustomers.forEach((c: any) => {
        cY += 18;
        doc.text(c.name, 50, cY);
        doc.text(c.phone, 220, cY);
        doc.text(String(c.orders), 330, cY, { width: 80, align: "right" });
        doc.text(`INR ${c.spend.toFixed(2)}`, 440, cY, { width: 80, align: "right" });
      });

      doc.y = cY + 25;
      doc.moveDown(1.5);

      // GST Breakdown Table
      doc.fontSize(14).font("Helvetica-Bold").text("GST Breakdown Summary", 40);
      doc.rect(40, doc.y + 5, 515, 1).fill("#e5e7eb");
      doc.moveDown(1);

      let gY = doc.y;
      doc.fontSize(9).font("Helvetica-Bold").text("GST Slab", 50, gY);
      doc.text("Taxable Value", 250, gY, { width: 120, align: "right" });
      doc.text("Tax Collected", 400, gY, { width: 120, align: "right" });

      doc.font("Helvetica");
      data.gstSummary.forEach((g: any) => {
        gY += 18;
        doc.text(`GST ${g.slab}`, 50, gY);
        doc.text(`INR ${g.taxable.toFixed(2)}`, 250, gY, { width: 120, align: "right" });
        doc.text(`INR ${g.tax.toFixed(2)}`, 400, gY, { width: 120, align: "right" });
      });

      doc.y = gY + 30;
      doc.moveDown(1);
      doc.fontSize(8).font("Helvetica-Oblique").text("End of generated report. Orion POS system.", { align: "center" });

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
      const { clause, params } = this.reportsRepo["getDateCondition"](filter, startDate, endDate);
      const salesRows = db.prepare(`
        SELECT invoice_number as Invoice, 
               created_at as Date, 
               cashier_name as Cashier, 
               payment_method as Payment, 
               subtotal/100.0 as Subtotal, 
               discount/100.0 as Discount, 
               gst/100.0 as GST, 
               grand_total/100.0 as Total,
               public_token as PublicToken
        FROM sales
        WHERE ${clause}
        ORDER BY id DESC
      `).all(params);

      // 2. Fetch Active Customers
      const customersRows = db.prepare(`
        SELECT id as ID, 
               name as Name, 
               phone as Phone, 
               email as Email, 
               address as Address, 
               total_orders as TotalOrders, 
               lifetime_value/100.0 as LifetimeValue_INR, 
               last_visit as LastVisit, 
               created_at as CreatedAt 
        FROM customers 
        WHERE is_active = 1
      `).all();

      // 3. Fetch Active Products
      const productsRows = db.prepare(`
        SELECT id as ID, 
               sku as SKU, 
               barcode as Barcode, 
               name as Name, 
               category as Category, 
               purchase_price/100.0 as PurchasePrice_INR, 
               selling_price/100.0 as SellingPrice_INR, 
               stock as Stock, 
               minimum_stock as MinimumStock, 
               gst as GST_Percent 
        FROM products 
        WHERE is_active = 1
      `).all();

      // 4. GST Summary Sheet
      const gstSheetRows = data.gstSummary.map((g: any) => ({
        GST_Slab: g.slab,
        Taxable_Value_INR: g.taxable,
        Tax_Collected_INR: g.tax
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

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.status(200).send(buf);
    } catch (error) {
      next(error);
    }
  };
}

