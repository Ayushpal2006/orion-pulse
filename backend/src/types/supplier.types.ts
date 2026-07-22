export interface Supplier {
  id: number;
  store_id: number;
  supplier_code: string;
  company_name: string;
  name?: string; // Virtual mapped property for compatibility
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  gstin?: string | null; // Virtual mapped property for compatibility
  pan_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  opening_balance: number;
  current_balance: number;
  payment_terms: string | null;
  credit_limit: number;
  is_active: number;
  is_archived?: number; // Virtual mapped property for compatibility (1 - is_active)
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateSupplierDTO = {
  supplier_code?: string;
  company_name?: string;
  name?: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  gst_number?: string | null;
  gstin?: string | null;
  pan_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  opening_balance?: number;
  current_balance?: number;
  payment_terms?: string | null;
  credit_limit?: number;
  is_active?: number;
  is_archived?: number;
  notes?: string | null;
};

export type UpdateSupplierDTO = Partial<CreateSupplierDTO>;

export interface SupplierResponse {
  success: boolean;
  data: Supplier | Supplier[] | null;
}
