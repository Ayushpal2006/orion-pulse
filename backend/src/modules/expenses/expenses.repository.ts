import { db } from "../../db";
import { expenses, expense_categories } from "../../db/schema";
import { eq, and, desc, sql, SQL } from "drizzle-orm";
import { ExpenseCategory, Expense } from "./expenses.types";

export class ExpenseRepository {
  async findCategoryByName(name: string, organizationId: number, storeId: number): Promise<ExpenseCategory | null> {
    const [existing] = await db
      .select()
      .from(expense_categories)
      .where(
        and(
          eq(expense_categories.name, name),
          eq(expense_categories.organization_id, organizationId),
          eq(expense_categories.store_id, storeId)
        )
      )
      .limit(1);

    return (existing as ExpenseCategory) || null;
  }

  async findCategoryById(id: number, organizationId: number, storeId: number): Promise<ExpenseCategory | null> {
    const [category] = await db
      .select()
      .from(expense_categories)
      .where(
        and(
          eq(expense_categories.id, id),
          eq(expense_categories.organization_id, organizationId),
          eq(expense_categories.store_id, storeId)
        )
      )
      .limit(1);

    return (category as ExpenseCategory) || null;
  }

  async createCategory(name: string, organizationId: number, storeId: number): Promise<ExpenseCategory> {
    const [created] = await db
      .insert(expense_categories)
      .values({
        organization_id: organizationId,
        store_id: storeId,
        name,
      })
      .returning();

    return created as ExpenseCategory;
  }

  async getCategories(organizationId: number, storeId: number): Promise<ExpenseCategory[]> {
    const rows = await db
      .select()
      .from(expense_categories)
      .where(
        and(
          eq(expense_categories.organization_id, organizationId),
          eq(expense_categories.store_id, storeId)
        )
      )
      .orderBy(expense_categories.name);

    return rows as ExpenseCategory[];
  }

  async seedDefaultCategories(defaultNames: string[], organizationId: number, storeId: number): Promise<ExpenseCategory[]> {
    await db.insert(expense_categories).values(
      defaultNames.map((name) => ({ organization_id: organizationId, store_id: storeId, name }))
    );

    return this.getCategories(organizationId, storeId);
  }

  async createExpense(
    data: {
      category_id: number;
      amount: number;
      payment_method: string;
      vendor: string | null;
      description: string | null;
      date: Date;
      receipt_image_url: string | null;
    },
    organizationId: number,
    storeId: number
  ): Promise<Expense> {
    const [created] = await db
      .insert(expenses)
      .values({
        organization_id: organizationId,
        store_id: storeId,
        category_id: data.category_id,
        amount: data.amount,
        payment_method: data.payment_method,
        vendor: data.vendor,
        description: data.description,
        date: data.date,
        receipt_image_url: data.receipt_image_url,
      })
      .returning();

    return created as Expense;
  }

  async getExpenses(condition: SQL<unknown>): Promise<any[]> {
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
      .where(condition)
      .orderBy(desc(expenses.date));

    return rows;
  }

  async getSummary(condition: SQL<unknown>): Promise<{
    totalPaise: number;
    categoryBreakdown: { category: string; amount_INR: number }[];
    paymentBreakdown: { method: string; amount_INR: number }[];
  }> {
    // 1. Total expense sum
    const [sumRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(condition);
    const totalAmount = Number(sumRow?.total || 0) / 100.0;

    // 2. Category wise breakdown
    const categoryRows = await db
      .select({
        categoryName: expense_categories.name,
        total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .innerJoin(expense_categories, eq(expenses.category_id, expense_categories.id))
      .where(condition)
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
      .where(condition)
      .groupBy(expenses.payment_method);

    const paymentBreakdown = methodRows.map((r) => ({
      method: r.paymentMethod,
      amount_INR: Number(r.total) / 100.0,
    }));

    return {
      totalPaise: totalAmount,
      categoryBreakdown,
      paymentBreakdown,
    };
  }

  async updateExpense(
    id: number,
    organizationId: number,
    storeId: number,
    updateData: Record<string, any>
  ): Promise<Expense | null> {
    const [updated] = await db
      .update(expenses)
      .set(updateData)
      .where(
        and(
          eq(expenses.id, id),
          eq(expenses.organization_id, organizationId),
          eq(expenses.store_id, storeId)
        )
      )
      .returning();

    return (updated as Expense) || null;
  }

  async deleteExpense(id: number, organizationId: number, storeId: number): Promise<Expense | null> {
    const [deleted] = await db
      .delete(expenses)
      .where(
        and(
          eq(expenses.id, id),
          eq(expenses.organization_id, organizationId),
          eq(expenses.store_id, storeId)
        )
      )
      .returning();

    return (deleted as Expense) || null;
  }
}

export const expenseRepository = new ExpenseRepository();
