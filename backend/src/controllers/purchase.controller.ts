import { Request, Response, NextFunction } from "express";
import { PurchaseService } from "../services/purchase.service";
import { PdfService } from "../services/pdf.service";
import { ShareService } from "../services/share.service";
import { ValidationError } from "../utils/errors";
import { CreatePurchaseSchema, UpdatePurchaseSchema } from "../validation/purchase.validation";
import path from "path";
import fs from "fs";

export class PurchaseController {
  private service: PurchaseService;
  private pdfService: PdfService;
  private shareService: ShareService;

  constructor() {
    this.service = new PurchaseService();
    this.pdfService = new PdfService();
    this.shareService = new ShareService();
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreatePurchaseSchema.safeParse(req.body);
      if (!parsed.success) {
        const formattedMsg = parsed.error.issues.map((e) => `${e.path.join(".") || "field"}: ${e.message}`).join("; ");
        throw new ValidationError(formattedMsg);
      }

      const result = await this.service.create(parsed.data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        q: req.query.q as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await this.service.getAll(filters);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a positive integer");
      }

      const result = await this.service.getById(id);
      if (!result) {
        res.status(404).json({ success: false, error: "Purchase order not found" });
        return;
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a positive integer");
      }

      const parsed = UpdatePurchaseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((e) => e.message).join(", "));
      }

      const result = await this.service.update(id, parsed.data);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  voidPurchase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a positive integer");
      }

      const { reason } = req.body;
      if (!reason) {
        throw new ValidationError("Void reason is required");
      }

      const authenticatedReq = req as any;
      const voidedBy = authenticatedReq.user?.name || "Admin";

      const result = await this.service.voidPurchase(id, reason, voidedBy);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a positive integer");
      }

      const authenticatedReq = req as any;
      const deletedBy = authenticatedReq.user?.name || "Admin";

      const success = await this.service.delete(id, deletedBy);
      res.status(200).json({ success, message: "Purchase order soft-deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  getPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a positive integer");
      }

      const purchase = await this.service.getById(id);
      if (!purchase) {
        res.status(404).json({ success: false, error: "Purchase order not found" });
        return;
      }

      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const subFolder = path.join(process.cwd(), "storage/purchases", year, month);

      if (!fs.existsSync(subFolder)) {
        fs.mkdirSync(subFolder, { recursive: true });
      }

      const pdfFilename = `${purchase.po_number}.pdf`;
      const pdfPath = path.join(subFolder, pdfFilename);

      if (!fs.existsSync(pdfPath)) {
        await this.pdfService.generatePurchasePdf(purchase, pdfPath);
      }

      res.download(pdfPath, pdfFilename);
    } catch (error) {
      next(error);
    }
  };

  getWhatsAppShareLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a positive integer");
      }

      const purchase = await this.service.getById(id);
      if (!purchase) {
        res.status(404).json({ success: false, error: "Purchase order not found" });
        return;
      }

      const url = this.shareService.generateSupplierWhatsAppLink(purchase);
      res.status(200).json({ success: true, url });
    } catch (error) {
      next(error);
    }
  };
}
