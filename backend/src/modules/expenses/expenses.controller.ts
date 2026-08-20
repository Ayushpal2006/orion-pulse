import { Request, Response, NextFunction } from "express";
import { ExpenseService, expenseService } from "./expenses.service";

export class ExpenseController {
  constructor(private service: ExpenseService = expenseService) {}

  createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name } = req.body;
      const created = await this.service.createCategory({ name });
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  };

  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.service.getCategories();
      res.status(200).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  };

  createExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { categoryId, amount, paymentMethod, vendor, description, date, receiptImageUrl } = req.body;
      const created = await this.service.createExpense({
        categoryId,
        amount,
        paymentMethod,
        vendor,
        description,
        date,
        receiptImageUrl,
      });
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { categoryId, startDate, endDate } = req.query;
      const rows = await this.service.getExpenses({
        categoryId: categoryId ? parseInt(categoryId as string, 10) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });
      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  };

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filter, startDate, endDate } = req.query;
      const summary = await this.service.getSummary({
        filter: filter ? String(filter) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      });
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  };

  updateExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: "Invalid parameters" });
        return;
      }

      const { categoryId, amount, paymentMethod, vendor, description, date, receiptImageUrl } = req.body;
      const updated = await this.service.updateExpense(id, {
        categoryId,
        amount,
        paymentMethod,
        vendor,
        description,
        date,
        receiptImageUrl,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: "Invalid parameters" });
        return;
      }

      await this.service.deleteExpense(id);
      res.status(200).json({ success: true, message: "Expense entry deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const expenseController = new ExpenseController();
