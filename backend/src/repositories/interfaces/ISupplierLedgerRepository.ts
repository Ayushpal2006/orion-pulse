import { SupplierLedgerEntry } from "../../types/supplier-payment.types";

export interface ISupplierLedgerRepository {
  create(ledgerData: any, tx?: any): Promise<SupplierLedgerEntry>;
  getBySupplierId(
    supplierId: number,
    params?: {
      startDate?: string;
      endDate?: string;
      transaction_type?: string;
    },
    tx?: any
  ): Promise<SupplierLedgerEntry[]>;
  updateByReference(
    reference: string,
    newAmount: number,
    tx?: any
  ): Promise<void>;
  recalculateBalances(supplierId: number, tx?: any): Promise<void>;
}
