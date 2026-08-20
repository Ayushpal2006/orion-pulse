export interface ExpenseCategory {
  id: number;
  organization_id: number;
  store_id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Expense {
  id: number;
  organization_id: number;
  store_id: number;
  category_id: number;
  amount: number;
  payment_method: string;
  vendor: string | null;
  description: string | null;
  date: Date;
  receipt_image_url: string | null;
  created_at: Date;
  updated_at: Date;
  category_name?: string;
}

export interface CreateCategoryDTO {
  name: string;
}

export interface CreateExpenseDTO {
  categoryId: number;
  amount: number;
  paymentMethod: string;
  vendor?: string | null;
  description?: string | null;
  date?: string | Date;
  receiptImageUrl?: string | null;
}

export interface UpdateExpenseDTO {
  categoryId?: number;
  amount?: number;
  paymentMethod?: string;
  vendor?: string | null;
  description?: string | null;
  date?: string | Date;
  receiptImageUrl?: string | null;
}

export interface ExpenseFilterQuery {
  categoryId?: number;
  startDate?: string;
  endDate?: string;
}

export interface ExpenseSummaryQuery {
  filter?: string;
  startDate?: string;
  endDate?: string;
}

export interface CategoryBreakdown {
  category: string;
  amount_INR: number;
}

export interface PaymentBreakdown {
  method: string;
  amount_INR: number;
}

export interface ExpenseSummaryResponse {
  totalAmount_INR: number;
  categoryBreakdown: CategoryBreakdown[];
  paymentBreakdown: PaymentBreakdown[];
}
