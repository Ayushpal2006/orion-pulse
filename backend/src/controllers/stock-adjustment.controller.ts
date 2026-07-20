import { Request, Response, NextFunction } from "express";
import { StockAdjustmentService } from "../services/stock-adjustment.service";
import { ValidationError } from "../utils/errors";
import { CreateStockAdjustmentSchema } from "../validation/stock-adjustment.validation";

export class StockAdjustmentController {
  private service: StockAdjustmentService;

  constructor() {
    this.service = new StockAdjustmentService();
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateStockAdjustmentSchema.safeParse(req.body);
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
        product_id: req.query.product_id ? parseInt(req.query.product_id as string, 10) : undefined,
        adjustment_type: req.query.adjustment_type as string,
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
        res.status(404).json({ success: false, error: "Stock adjustment record not found" });
        return;
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
