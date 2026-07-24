import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { saleRepository } from "../repositories";
import { SalesService } from "../services/sales.service";
import { InvoiceService } from "../services/invoice.service";
import { PdfService } from "../services/pdf.service";

export class InvoiceController {
  private salesService: SalesService;
  private invoiceService: InvoiceService;
  private pdfService: PdfService;
  private saleRepo = saleRepository;

  constructor() {
    this.salesService = new SalesService();
    this.invoiceService = new InvoiceService();
    this.pdfService = new PdfService();
  }

  private async getInvoiceNumberByToken(token: string): Promise<string | null> {
    try {
      const sale = await this.saleRepo.getByPublicToken(token);
      return sale ? sale.invoice_number : null;
    } catch (e) {
      return null;
    }
  }

  private async getOrGenerateInvoicePdf(receipt: any): Promise<{ pdfPath: string; pdfFilename: string }> {
    const pdfFilename = `${receipt.invoiceNumber}.pdf`;

    // 1. Check if pdfUrl is saved in database and file exists on disk
    if (receipt.pdfUrl) {
      const existingPath = path.join(process.cwd(), receipt.pdfUrl.replace(/^\//, ""));
      if (fs.existsSync(existingPath)) {
        return { pdfPath: existingPath, pdfFilename };
      }
    }

    // 2. Check legacy uploads/invoices directory
    const legacyPath = path.join(process.cwd(), "uploads/invoices", pdfFilename);
    if (fs.existsSync(legacyPath)) {
      return { pdfPath: legacyPath, pdfFilename };
    }

    // 3. Reuse exact dashboard storage resolution logic (storage/invoices/YYYY/MM)
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const subFolder = path.join(process.cwd(), "storage/invoices", year, month);
    if (!fs.existsSync(subFolder)) {
      fs.mkdirSync(subFolder, { recursive: true });
    }

    const pdfPath = path.join(subFolder, pdfFilename);
    const pdfUrl = `/storage/invoices/${year}/${month}/${pdfFilename}`;

    if (!fs.existsSync(pdfPath)) {
      try {
        await this.pdfService.generateInvoicePdf(receipt, pdfPath);
        try {
          await this.saleRepo.updatePdfUrlByInvoice(receipt.invoiceNumber, pdfUrl);
        } catch (e) {
          console.error("Failed to update sales pdf_url:", e);
        }
      } catch (genError) {
        if (fs.existsSync(pdfPath)) {
          try {
            fs.unlinkSync(pdfPath);
          } catch (unlinkErr) {
            console.error("Failed to clean up incomplete PDF file:", unlinkErr);
          }
        }
        throw genError;
      }
    }

    return { pdfPath, pdfFilename };
  }

  renderPublicInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      if (!token) {
        res.status(400).send("Invalid Token");
        return;
      }

      const invoiceNumber = await this.getInvoiceNumberByToken(token);
      if (!invoiceNumber) {
        res.status(404).send("Invoice Not Found");
        return;
      }

      const receipt = await this.salesService.getReceipt(invoiceNumber);
      const { pdfPath } = await this.getOrGenerateInvoicePdf(receipt);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      res.sendFile(pdfPath);
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

      const invoiceNumber = await this.getInvoiceNumberByToken(token);
      if (!invoiceNumber) {
        res.status(404).send("Invoice Not Found");
        return;
      }

      const receipt = await this.salesService.getReceipt(invoiceNumber);
      const { pdfPath, pdfFilename } = await this.getOrGenerateInvoicePdf(receipt);

      res.download(pdfPath, pdfFilename, (err) => {
        if (err) {
          if (!res.headersSent) {
            next(err);
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
