import { Request, Response, NextFunction } from "express";
import { SupplierPaymentService } from "../services/supplier-payment.service";
import { ValidationError } from "../utils/errors";
import { CreateSupplierPaymentSchema } from "../validation/supplier-payment.validation";

export class SupplierPaymentController {
  private service: SupplierPaymentService;

  constructor() {
    this.service = new SupplierPaymentService();
  }

  createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateSupplierPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((e) => e.message).join(", "));
      }

      const result = await this.service.createPayment(parsed.data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        q: req.query.q as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        supplier_id: req.query.supplier_id ? parseInt(req.query.supplier_id as string, 10) : undefined,
      };

      const result = await this.service.getAllPayments(filters);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getLedgerBySupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const supplierId = parseInt(req.params.supplierId as string, 10);
      if (isNaN(supplierId)) {
        throw new ValidationError("Supplier ID must be a positive integer");
      }

      const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        transaction_type: req.query.transaction_type as string,
      };

      const result = await this.service.getLedgerBySupplierId(supplierId, filters);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getSupplierReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getSupplierReports();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
