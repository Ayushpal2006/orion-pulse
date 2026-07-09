import { Request, Response, NextFunction } from "express";
import { SalesService } from "../services/sales.service";

export class SalesController {
  private service: SalesService;

  constructor() {
    this.service = new SalesService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sales = await this.service.getAll();
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
      const id = parseInt(req.params.id, 10);
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
}
