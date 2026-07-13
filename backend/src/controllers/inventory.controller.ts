import { Request, Response, NextFunction } from "express";
import { InventoryService } from "../services/inventory.service";
import { ValidationError } from "../utils/errors";

export class InventoryController {
  private service: InventoryService;

  constructor() {
    this.service = new InventoryService();
  }

  adjust = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId, quantity, type, reason } = req.body;
      if (!productId || !quantity || !type || !reason) {
        throw new ValidationError("productId, quantity, type (ADD/REMOVE), and reason are required");
      }

      const result = await this.service.adjustStock(productId, quantity, type, reason);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getReorderSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getReorderSuggestions();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getValuation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getInventoryValuation();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
