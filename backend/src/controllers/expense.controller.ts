import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { expenses, expense_categories } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError, NotFoundError } from "../utils/errors";

export class ExpenseController {
  createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const { name } = req.body;
      if (!name) {
        throw new ValidationError("Category name is required");
      }

      // Check duplicate
      const [existing] = await db
        .select()
        .from(expense_categories)
        .where(and(eq(expense_categories.name, name), eq(expense_categories.store_id, storeId)))
        .limit(1);

      if (existing) {
        throw new ValidationError(`Category "${name}" already exists`);
      }

      const [created] = await db
        .insert(expense_categories)
        .values({
          store_id: storeId,
          name,
        })
        .returning();

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  };

  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const rows = await db
        .select()
        .from(expense_categories)
        .where(eq(expense_categories.store_id, storeId))
        .orderBy(expense_categories.name);

      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  };

  createExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const { categoryId, amount, paymentMethod, vendor, description, date, receiptImageUrl } = req.body;
      if (!categoryId || !amount || amount <= 0 || !paymentMethod) {
        throw new ValidationError("categoryId, amount (>0), and paymentMethod are required");
      }

      // Verify category
      const [category] = await db
        .select()
        .from(expense_categories)
        .where(and(eq(expense_categories.id, categoryId), eq(expense_categories.store_id, storeId)))
        .limit(1);

      if (!category) {
        throw new NotFoundError("Expense category not found");
      }

      const [created] = await db
        .insert(expenses)
        .values({
          store_id: storeId,
          category_id: categoryId,
          amount,
          payment_method: paymentMethod,
          vendor: vendor ?? null,
          description: description ?? null,
          date: date ? new Date(date) : new Date(),
          receipt_image_url: receiptImageUrl ?? null,
        })
        .returning();

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const { categoryId, startDate, endDate } = req.query;

      let cond = eq(expenses.store_id, storeId);
      if (categoryId) {
        cond = and(cond, eq(expenses.category_id, parseInt(categoryId as string, 10))) as any;
      }
      if (startDate) {
        const actualEnd = endDate || startDate;
        cond = and(
          cond,
          sql`timezone('Asia/Kolkata', ${expenses.date})::date >= ${startDate}::date AND timezone('Asia/Kolkata', ${expenses.date})::date <= ${actualEnd}::date`
        ) as any;
      }

      const rows = await db
        .select({
          id: expenses.id,
          amount: expenses.amount,
          payment_method: expenses.payment_method,
          vendor: expenses.vendor,
          description: expenses.description,
          date: expenses.date,
          receipt_image_url: expenses.receipt_image_url,
          category_name: expense_categories.name,
        })
        .from(expenses)
        .innerJoin(expense_categories, eq(expenses.category_id, expense_categories.id))
        .where(cond)
        .orderBy(desc(expenses.date));

      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  };

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const { filter, startDate, endDate } = req.query;

      let cond = eq(expenses.store_id, storeId);

      // Date range filtering helper
      if (filter === "today") {
        cond = and(cond, sql`timezone('Asia/Kolkata', ${expenses.date})::date = timezone('Asia/Kolkata', now())::date`) as any;
      } else if (filter === "last7") {
        cond = and(cond, sql`timezone('Asia/Kolkata', ${expenses.date})::date >= (timezone('Asia/Kolkata', now()) - interval '6 days')::date`) as any;
      } else if (filter === "last30") {
        cond = and(cond, sql`timezone('Asia/Kolkata', ${expenses.date})::date >= (timezone('Asia/Kolkata', now()) - interval '29 days')::date`) as any;
      } else if (startDate) {
        const actualEnd = endDate || startDate;
        cond = and(
          cond,
          sql`timezone('Asia/Kolkata', ${expenses.date})::date >= ${startDate}::date AND timezone('Asia/Kolkata', ${expenses.date})::date <= ${actualEnd}::date`
        ) as any;
      }

      // 1. Total expense sum
      const [sumRow] = await db
        .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
        .from(expenses)
        .where(cond);
      const totalAmount = Number(sumRow?.total || 0) / 100.0;

      // 2. Category wise breakdown
      const categoryRows = await db
        .select({
          categoryName: expense_categories.name,
          total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .innerJoin(expense_categories, eq(expenses.category_id, expense_categories.id))
        .where(cond)
        .groupBy(expense_categories.name);

      const categoryBreakdown = categoryRows.map((r) => ({
        category: r.categoryName,
        amount_INR: Number(r.total) / 100.0,
      }));

      // 3. Payment method wise breakdown
      const methodRows = await db
        .select({
          paymentMethod: expenses.payment_method,
          total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(cond)
        .groupBy(expenses.payment_method);

      const paymentBreakdown = methodRows.map((r) => ({
        method: r.paymentMethod,
        amount_INR: Number(r.total) / 100.0,
      }));

      res.status(200).json({
        success: true,
        data: {
          totalAmount_INR: totalAmount,
          categoryBreakdown,
          paymentBreakdown,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const storeId = getStoreId();
      if (isNaN(id) || storeId === undefined) {
        res.status(400).json({ success: false, error: "Invalid parameters" });
        return;
      }

      const [deleted] = await db
        .delete(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.store_id, storeId)))
        .returning();

      if (!deleted) {
        throw new NotFoundError(`Expense with ID ${id} not found`);
      }

      res.status(200).json({ success: true, message: "Expense entry deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
