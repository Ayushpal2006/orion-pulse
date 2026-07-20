export type SupplierPaymentMethod =
  | "Cash"
  | "UPI"
  | "Bank Transfer"
  | "Cheque"
  | "Card"
  | "Other";

export interface SupplierPayment {
  id: number;
  store_id: number;
  supplier_id: number;
  payment_number: string;
  amount: number; // Paise
  payment_method: SupplierPaymentMethod;
  reference_number: string | null;
  notes: string | null;
  payment_date: string;
  created_by: string;
  created_at: string;
  supplier_name?: string;
}

export type SupplierLedgerTransactionType = "PURCHASE" | "PAYMENT" | "PURCHASE_CANCEL";

export interface SupplierLedgerEntry {
  id: number;
  store_id: number;
  supplier_id: number;
  transaction_type: SupplierLedgerTransactionType;
  amount: number; // Paise
  balance: number; // Paise, running outstanding balance
  reference: string | null; // e.g. PRCH-... or PMT-...
  created_at: string;
}

export interface CreateSupplierPaymentDTO {
  supplier_id: number;
  amount: number; // Paise
  payment_method: SupplierPaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
  payment_date?: string;
}
