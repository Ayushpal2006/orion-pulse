import { Request, Response, NextFunction } from "express";
import { ExportService } from "../services/export.service";

export class ExportController {
  private service: ExportService;

  constructor() {
    this.service = new ExportService();
  }

  exportProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buffer = await this.service.exportProductsToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=products_export.xlsx");
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  };

  exportSuppliers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buffer = await this.service.exportSuppliersToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=suppliers_export.xlsx");
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  };

  exportSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buffer = await this.service.exportSalesToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=sales_export.xlsx");
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  };

  exportExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buffer = await this.service.exportExpensesToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=expenses_export.xlsx");
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  };
}
