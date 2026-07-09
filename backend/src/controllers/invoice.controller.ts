import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import db from "../database/db";
import { SalesService } from "../services/sales.service";
import { InvoiceService } from "../services/invoice.service";
import { PdfService } from "../services/pdf.service";

export class InvoiceController {
  private salesService: SalesService;
  private invoiceService: InvoiceService;
  private pdfService: PdfService;

  constructor() {
    this.salesService = new SalesService();
    this.invoiceService = new InvoiceService();
    this.pdfService = new PdfService();
  }

  private getInvoiceNumberByToken(token: string): string | null {
    try {
      const stmt = db.prepare("SELECT invoice_number FROM sales WHERE public_token = ?");
      const row = stmt.get(token) as { invoice_number: string } | undefined;
      return row ? row.invoice_number : null;
    } catch (e) {
      return null;
    }
  }

  renderPublicInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      if (!token) {
        res.status(400).send("Invalid Token");
        return;
      }

      // Check cache first
      const cachedHtml = this.invoiceService.getFromCache(token);
      if (cachedHtml) {
        res.status(200).send(cachedHtml);
        return;
      }

      const invoiceNumber = this.getInvoiceNumberByToken(token);
      if (!invoiceNumber) {
        res.status(404).send("Invoice Not Found");
        return;
      }

      const receipt = await this.salesService.getReceipt(invoiceNumber);
      const html = this.invoiceService.generateHtmlInvoice(receipt);
      
      // Save in cache
      this.invoiceService.setToCache(token, html);

      res.status(200).send(html);
    } catch (error) {
      next(error);
    }
  };

  downloadPublicInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      if (!token) {
        res.status(400).send("Invalid Token");
        return;
      }

      const invoiceNumber = this.getInvoiceNumberByToken(token);
      if (!invoiceNumber) {
        res.status(404).send("Invoice Not Found");
        return;
      }

      const receipt = await this.salesService.getReceipt(invoiceNumber);
      const pdfFilename = `${receipt.invoiceNumber}.pdf`;
      const pdfPath = path.join(__dirname, "../../../uploads/invoices", pdfFilename);

      // Generate A4 PDF if missing
      if (!fs.existsSync(pdfPath)) {
        await this.pdfService.generateInvoicePdf(receipt, pdfPath);
        
        // Save PDF path in db
        try {
          const updateStmt = db.prepare("UPDATE sales SET pdf_url = ? WHERE invoice_number = ?");
          updateStmt.run(`/uploads/invoices/${pdfFilename}`, receipt.invoiceNumber);
        } catch (e) {
          console.error("Failed to update pdf_url:", e);
        }
      }

      res.download(pdfPath, pdfFilename, (err) => {
        if (err) {
          next(err);
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
