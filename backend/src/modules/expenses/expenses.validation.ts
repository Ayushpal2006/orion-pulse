import { ValidationError } from "../../utils/errors";
import { CreateCategoryDTO, CreateExpenseDTO } from "./expenses.types";

export class ExpenseValidator {
  static validateCreateCategory(dto: CreateCategoryDTO): void {
    if (!dto.name || typeof dto.name !== "string" || dto.name.trim().length === 0) {
      throw new ValidationError("Category name is required");
    }
  }

  static validateCreateExpense(dto: CreateExpenseDTO): void {
    if (!dto.categoryId || typeof dto.categoryId !== "number" || isNaN(dto.categoryId)) {
      throw new ValidationError("categoryId is required and must be a valid number");
    }
    if (dto.amount === undefined || dto.amount === null || typeof dto.amount !== "number" || isNaN(dto.amount) || dto.amount <= 0) {
      throw new ValidationError("amount (>0) is required");
    }
    if (!dto.paymentMethod || typeof dto.paymentMethod !== "string" || dto.paymentMethod.trim().length === 0) {
      throw new ValidationError("paymentMethod is required");
    }
  }
}
