import { Request, Response, NextFunction } from "express";
import { PurchaseService } from "../services/purchase.service";
import { ValidationError } from "../utils/errors";
import { CreatePurchaseSchema, UpdatePurchaseSchema } from "../validation/purchase.validation";

export class PurchaseController {
  private service: PurchaseService;

  constructor() {
    this.service = new PurchaseService();
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreatePurchaseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((e) => e.message).join(", "));
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

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a positive integer");
      }

      const success = await this.service.delete(id);
      res.status(200).json({ success, message: "Purchase order deleted and stock reversed successfully" });
    } catch (error) {
      next(error);
    }
  };
}
