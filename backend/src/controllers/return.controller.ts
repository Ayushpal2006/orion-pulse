import { Request, Response, NextFunction } from "express";
import { ReturnService } from "../services/return.service";
import { ValidationError } from "../utils/errors";

export class ReturnController {
  private service: ReturnService;

  constructor() {
    this.service = new ReturnService();
  }

  processReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const saleId = parseInt(req.params.id as string, 10);
      if (isNaN(saleId)) {
        throw new ValidationError("Original sale ID must be a number");
      }

      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        throw new ValidationError("Items list is required for returns processing");
      }

      const result = await this.service.processReturn(saleId, items);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getReturnsBySale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const saleId = parseInt(req.params.id as string, 10);
      if (isNaN(saleId)) {
        throw new ValidationError("Original sale ID must be a number");
      }

      const result = await this.service.getReturnsBySaleId(saleId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
