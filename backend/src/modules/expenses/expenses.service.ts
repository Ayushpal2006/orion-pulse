import { getTenantContext } from "../../db/context";
import { getUtcBoundariesForFilter } from "../../utils/datetime";
import { ValidationError, NotFoundError } from "../../utils/errors";
import { ExpenseRepository, expenseRepository } from "./expenses.repository";
import { ExpenseValidator } from "./expenses.validation";
import {
  CreateCategoryDTO,
  CreateExpenseDTO,
  UpdateExpenseDTO,
  ExpenseFilterQuery,
  ExpenseSummaryQuery,
  ExpenseCategory,
  Expense,
  ExpenseSummaryResponse,
} from "./expenses.types";
import { expenses } from "../../db/schema";
import { eq, and, gte, lte, SQL } from "drizzle-orm";

export class ExpenseService {
  constructor(private repo: ExpenseRepository = expenseRepository) {}

  async createCategory(dto: CreateCategoryDTO): Promise<ExpenseCategory> {
    ExpenseValidator.validateCreateCategory(dto);
    const { organizationId, currentStoreId } = getTenantContext();

    const name = dto.name.trim();
    const existing = await this.repo.findCategoryByName(name, organizationId, currentStoreId);
    if (existing) {
      throw new ValidationError(`Category "${name}" already exists`);
    }

    return this.repo.createCategory(name, organizationId, currentStoreId);
  }

  async getCategories(): Promise<ExpenseCategory[]> {
    const { organizationId, currentStoreId } = getTenantContext();

    let rows = await this.repo.getCategories(organizationId, currentStoreId);
    if (rows.length === 0) {
      const defaultNames = ["Rent", "Electricity", "Salary", "Transport", "Maintenance", "Marketing", "Miscellaneous"];
      rows = await this.repo.seedDefaultCategories(defaultNames, organizationId, currentStoreId);
    }

    return rows;
  }

  async createExpense(dto: CreateExpenseDTO): Promise<Expense> {
    ExpenseValidator.validateCreateExpense(dto);
    const { organizationId, currentStoreId } = getTenantContext();

    // Verify category exists in current tenant
    const category = await this.repo.findCategoryById(dto.categoryId, organizationId, currentStoreId);
    if (!category) {
      throw new NotFoundError("Expense category not found");
    }

    return this.repo.createExpense(
      {
        category_id: dto.categoryId,
        amount: dto.amount,
        payment_method: dto.paymentMethod,
        vendor: dto.vendor ?? null,
        description: dto.description ?? null,
        date: dto.date ? new Date(dto.date) : new Date(),
        receipt_image_url: dto.receiptImageUrl ?? null,
      },
      organizationId,
      currentStoreId
    );
  }

  async getExpenses(filter: ExpenseFilterQuery): Promise<any[]> {
    const { organizationId, currentStoreId } = getTenantContext();

    let cond: SQL<unknown> = and(
      eq(expenses.organization_id, organizationId),
      eq(expenses.store_id, currentStoreId)
    ) as SQL<unknown>;

    if (filter.categoryId) {
      cond = and(cond, eq(expenses.category_id, filter.categoryId)) as SQL<unknown>;
    }
    if (filter.startDate) {
      const actualEnd = filter.endDate || filter.startDate;
      const { start, end } = getUtcBoundariesForFilter("custom", String(filter.startDate), String(actualEnd));
      cond = and(cond, gte(expenses.date, start), lte(expenses.date, end)) as SQL<unknown>;
    }

    return this.repo.getExpenses(cond);
  }

  async getSummary(query: ExpenseSummaryQuery): Promise<ExpenseSummaryResponse> {
    const { organizationId, currentStoreId } = getTenantContext();

    let cond: SQL<unknown> = and(
      eq(expenses.organization_id, organizationId),
      eq(expenses.store_id, currentStoreId)
    ) as SQL<unknown>;

    if (query.filter || query.startDate) {
      const { start, end } = getUtcBoundariesForFilter(
        String(query.filter || "custom"),
        query.startDate ? String(query.startDate) : undefined,
        query.endDate ? String(query.endDate) : undefined
      );
      cond = and(cond, gte(expenses.date, start), lte(expenses.date, end)) as SQL<unknown>;
    }

    const summary = await this.repo.getSummary(cond);
    return {
      totalAmount_INR: summary.totalPaise,
      categoryBreakdown: summary.categoryBreakdown,
      paymentBreakdown: summary.paymentBreakdown,
    };
  }

  async updateExpense(id: number, dto: UpdateExpenseDTO): Promise<Expense> {
    const { organizationId, currentStoreId } = getTenantContext();

    const updateData: Record<string, any> = {};
    if (dto.categoryId !== undefined) updateData.category_id = dto.categoryId;
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.paymentMethod !== undefined) updateData.payment_method = dto.paymentMethod;
    if (dto.vendor !== undefined) updateData.vendor = dto.vendor;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.date !== undefined) updateData.date = new Date(dto.date);
    if (dto.receiptImageUrl !== undefined) updateData.receipt_image_url = dto.receiptImageUrl;
    updateData.updated_at = new Date();

    const updated = await this.repo.updateExpense(id, organizationId, currentStoreId, updateData);
    if (!updated) {
      throw new NotFoundError(`Expense with ID ${id} not found`);
    }

    return updated;
  }

  async deleteExpense(id: number): Promise<void> {
    const { organizationId, currentStoreId } = getTenantContext();

    const deleted = await this.repo.deleteExpense(id, organizationId, currentStoreId);
    if (!deleted) {
      throw new NotFoundError(`Expense with ID ${id} not found`);
    }
  }
}

export const expenseService = new ExpenseService();
