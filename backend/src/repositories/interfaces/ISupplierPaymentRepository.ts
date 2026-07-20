import { SupplierPayment } from "../../types/supplier-payment.types";

export interface ISupplierPaymentRepository {
  create(paymentData: any, tx?: any): Promise<SupplierPayment>;
  getAll(
    params?: {
      q?: string;
      startDate?: string;
      endDate?: string;
      supplier_id?: number;
    },
    tx?: any
  ): Promise<SupplierPayment[]>;
  getById(id: number, tx?: any): Promise<SupplierPayment | null>;
}
