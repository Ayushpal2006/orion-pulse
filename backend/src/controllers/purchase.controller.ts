import { Request, Response, NextFunction } from "express";
import { PurchaseService } from "../services/purchase.service";
import { ValidationError } from "../utils/errors";

export class PurchaseController {
  private service: PurchaseService;

  constructor() {
    this.service = new PurchaseService();
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a number");
      }
      const result = await this.service.getById(id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  receive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        throw new ValidationError("ID must be a number");
      }

      const { items, invoiceDetails } = req.body;
      if (!items || !Array.isArray(items)) {
        throw new ValidationError("Items list is required for receiving goods");
      }

      const result = await this.service.receiveGoods(id, items, invoiceDetails ?? {});
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getAll();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
