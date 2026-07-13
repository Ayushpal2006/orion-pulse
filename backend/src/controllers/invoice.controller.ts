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
      const pdfFilename = `${receipt.invoiceNumber}.pdf`;
      const pdfPath = path.join(__dirname, "../../uploads/invoices", pdfFilename);

      // Generate A4 PDF if missing
      if (!fs.existsSync(pdfPath)) {
        try {
          await this.pdfService.generateInvoicePdf(receipt, pdfPath);
          try {
            await this.saleRepo.updatePdfUrlByInvoice(receipt.invoiceNumber, `/uploads/invoices/${pdfFilename}`);
          } catch (e) {
            console.error("Failed to update pdf_url:", e);
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
      const pdfFilename = `${receipt.invoiceNumber}.pdf`;
      const pdfPath = path.join(__dirname, "../../uploads/invoices", pdfFilename);

      // Generate A4 PDF if missing
      if (!fs.existsSync(pdfPath)) {
        try {
          await this.pdfService.generateInvoicePdf(receipt, pdfPath);
          
          // Save PDF path in db
          try {
            await this.saleRepo.updatePdfUrlByInvoice(receipt.invoiceNumber, `/uploads/invoices/${pdfFilename}`);
          } catch (e) {
            console.error("Failed to update pdf_url:", e);
          }
        } catch (genError) {
          // Clean up incomplete/partially written files to prevent sending corrupted files next time
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
