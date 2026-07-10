import { Request, Response, NextFunction } from "express";
import { SalesService } from "../services/sales.service";
import { PrinterService } from "../services/printer.service";
import { EscposFormatter } from "../services/escpos.service";
import { ShareService } from "../services/share.service";
import { PdfService } from "../services/pdf.service";
import path from "path";
import fs from "fs";
import db from "../database/db";

export class SalesController {
  private service: SalesService;
  private printerService: PrinterService;
  private shareService: ShareService;

  constructor() {
    this.service = new SalesService();
    this.printerService = new PrinterService();
    this.shareService = new ShareService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const phone = req.query.phone as string | undefined;
      const sales = phone
        ? await this.service.getByCustomerPhone(phone)
        : await this.service.getAll();
      res.status(200).json({
        success: true,
        data: sales,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "ID must be a number",
        });
        return;
      }
      const data = await this.service.getById(id);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getByInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = req.params.invoice;
      if (!invoice) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Invoice parameter is required",
        });
        return;
      }
      const data = await this.service.getByInvoice(invoice as string);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getToday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sales = await this.service.getTodaySales();
      res.status(200).json({
        success: true,
        data: sales,
      });
    } catch (error) {
      next(error);
    }
  };

  getReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Sale ID or Invoice parameter is required",
        });
        return;
      }
      const data = await this.service.getReceipt(id);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  printReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Sale ID or Invoice parameter is required",
        });
        return;
      }

      const receipt = await this.service.getReceipt(id);

      const printerConfig = this.printerService.getPrinterConfig();
      const formatter = new EscposFormatter(printerConfig);
      const buffer = formatter.formatReceipt(receipt);

      const result = await this.printerService.printBuffer(buffer, printerConfig);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getWhatsAppShareLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Sale ID or Invoice parameter is required",
        });
        return;
      }

      const receipt = await this.service.getReceipt(id);
      const url = this.shareService.generateWhatsAppLink(receipt);

      res.status(200).json({
        success: true,
        url,
      });
    } catch (error) {
      next(error);
    }
  };

  getPdfReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      if (!id) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Sale ID or Invoice parameter is required",
        });
        return;
      }

      const receipt = await this.service.getReceipt(id);
      const pdfFilename = `${receipt.invoiceNumber}.pdf`;
      const pdfPath = path.join(__dirname, "../../uploads/invoices", pdfFilename);

      if (!fs.existsSync(pdfPath)) {
        const pdfService = new PdfService();
        try {
          await pdfService.generateInvoicePdf(receipt, pdfPath);

          try {
            db.prepare("UPDATE sales SET pdf_url = ? WHERE invoice_number = ?").run(
              `/uploads/invoices/${pdfFilename}`,
              receipt.invoiceNumber
            );
          } catch (e) {
            console.error("Failed to update sales pdf_url:", e);
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
