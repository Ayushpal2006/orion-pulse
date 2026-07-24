import { Request, Response, NextFunction } from "express";
import { saleRepository, settingsRepository } from "../repositories";
import { SalesService } from "../services/sales.service";
import { PrinterService } from "../services/printer.service";
import { EscposFormatter } from "../services/escpos.service";
import { ShareService } from "../services/share.service";
import { PdfService } from "../services/pdf.service";
import path from "path";
import fs from "fs";

export class SalesController {
  private service: SalesService;
  private printerService: PrinterService;
  private shareService: ShareService;
  private saleRepo = saleRepository;

  constructor() {
    this.service = new SalesService();
    this.printerService = new PrinterService();
    this.shareService = new ShareService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        page,
        limit,
        search,
        invoice,
        customer,
        phone,
        customerId,
        payment,
        status,
        date,
        startDate,
        endDate,
        dateFilter,
        sort,
        cashier,
      } = req.query;

      if (page || limit || search || status || sort || dateFilter) {
        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = parseInt(limit as string, 10) || 20;

        const result = await this.saleRepo.searchSalesPaginated({
          page: pageNum,
          limit: limitNum,
          search: search as string,
          invoiceNumber: invoice as string,
          customerName: customer as string,
          phone: phone as string,
          customerId: customerId ? parseInt(customerId as string, 10) : undefined,
          paymentMethod: payment as string,
          status: status as string,
          date: date as string,
          startDate: startDate as string,
          endDate: endDate as string,
          dateFilter: dateFilter as string,
          sort: sort as string,
        });

        res.status(200).json({
          success: true,
          data: result.sales,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount: result.totalCount,
            totalPages: Math.ceil(result.totalCount / limitNum),
          }
        });
        return;
      }

      let salesData;
      if (invoice || customer || phone || date || cashier || payment || startDate) {
        salesData = await this.saleRepo.searchSales({
          invoiceNumber: invoice as string,
          customerName: customer as string,
          phone: phone as string,
          date: date as string,
          cashier: cashier as string,
          paymentMethod: payment as string,
          startDate: startDate as string,
          endDate: endDate as string,
        });
      } else {
        salesData = await this.service.getAll();
      }

      res.status(200).json({
        success: true,
        data: salesData,
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
      const invoice = req.params.invoice as string;
      if (!invoice) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Invoice parameter is required",
        });
        return;
      }
      const data = await this.service.getByInvoice(invoice);
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

      const printerConfig = await this.printerService.getPrinterConfig();
      const formatter = new EscposFormatter(printerConfig);
      const template = await settingsRepository.get("receipt_template", "Classic");
      const buffer = formatter.formatReceipt(receipt, template);

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
      
      // Determine year and month folders based on current date
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, "0");
      
      const subFolder = path.join(process.cwd(), "storage/invoices", year, month);
      if (!fs.existsSync(subFolder)) {
        fs.mkdirSync(subFolder, { recursive: true });
      }

      const pdfFilename = `${receipt.invoiceNumber}.pdf`;
      const pdfPath = path.join(subFolder, pdfFilename);
      const pdfUrl = `/storage/invoices/${year}/${month}/${pdfFilename}`;

      if (!fs.existsSync(pdfPath)) {
        const pdfService = new PdfService();
        try {
          await pdfService.generateInvoicePdf(receipt, pdfPath);

          try {
            await this.saleRepo.updatePdfUrlByInvoice(receipt.invoiceNumber, pdfUrl);
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

  voidInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const authenticatedReq = req as any; // Cast request to read authenticated user
      const voidedBy = authenticatedReq.user?.name || "Admin";
      const userId = authenticatedReq.user?.id || 1;

      if (!id) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Sale ID or Invoice number is required",
        });
        return;
      }

      if (!reason) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Void reason is required",
        });
        return;
      }

      let saleId: number;
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId) && String(numericId) === id) {
        saleId = numericId;
      } else {
        const sale = await this.service.getByInvoice(id);
        if (!sale) {
          res.status(404).json({ success: false, error: "Invoice not found" });
          return;
        }
        saleId = sale.sale.id;
      }

      const result = await this.service.voidInvoice(saleId, reason, voidedBy, userId);

      const updatedReceipt = await this.service.getReceipt(String(saleId));
      res.status(200).json({
        success: true,
        data: updatedReceipt,
      });
    } catch (error) {
      next(error);
    }
  };

  logAuditAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { action, details } = req.body;
      const authenticatedReq = req as any;
      const userId = authenticatedReq.user?.id || 1;
      const storeId = authenticatedReq.user?.storeId || 1;

      if (!action) {
        res.status(400).json({ success: false, error: "Action is required" });
        return;
      }

      await this.service.logAudit(storeId, userId, action, details);

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  editInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const authenticatedReq = req as any;
      const actingUser = {
        userId: authenticatedReq.user?.id || 1,
        role: authenticatedReq.user?.role || "Admin",
        name: authenticatedReq.user?.name || "Admin",
      };

      if (!id) {
        res.status(400).json({ success: false, error: "Sale ID is required" });
        return;
      }

      let saleId: number;
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId) && String(numericId) === id) {
        saleId = numericId;
      } else {
        const sale = await this.service.getByInvoice(id);
        saleId = sale.sale.id;
      }

      const updatedSale = await this.service.editInvoice(saleId, req.body, actingUser);
      const updatedReceipt = await this.service.getReceipt(String(saleId));

      res.status(200).json({
        success: true,
        data: updatedReceipt,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const authenticatedReq = req as any;
      const deletedBy = authenticatedReq.user?.name || "Admin";
      const userId = authenticatedReq.user?.id || 1;

      if (!id) {
        res.status(400).json({ success: false, error: "Sale ID is required" });
        return;
      }

      let saleId: number;
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId) && String(numericId) === id) {
        saleId = numericId;
      } else {
        const sale = await this.service.getByInvoice(id);
        saleId = sale.sale.id;
      }

      const deletedSale = await this.service.deleteInvoice(saleId, deletedBy, userId);

      res.status(200).json({
        success: true,
        data: deletedSale,
      });
    } catch (error) {
      next(error);
    }
  };
}
