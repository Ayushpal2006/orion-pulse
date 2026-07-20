export interface Supplier {
  id: number;
  store_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
  is_archived: number; // 0 for active, 1 for archived
  created_at: string;
  updated_at: string;
}

export type CreateSupplierDTO = {
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  notes?: string | null;
  is_archived?: number;
};

export type UpdateSupplierDTO = Partial<CreateSupplierDTO>;

export interface SupplierResponse {
  success: boolean;
  data: Supplier | Supplier[] | null;
}
