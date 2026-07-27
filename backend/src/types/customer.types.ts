export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  total_orders: number;
  lifetime_value: number; // stored in paise (paise = Rs * 100)
  last_visit: string | null; // DATETIME ISO/SQL String
  type?: string;
  is_system?: number;
  is_protected?: number;
  is_active?: number;
  created_at: string;
  updated_at: string;
}

export type CreateCustomerDTO = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  total_orders?: number;
  lifetime_value?: number;
  last_visit?: string | null;
  type?: string;
  is_system?: number;
  is_protected?: number;
  is_active?: number;
};

export type UpdateCustomerDTO = Partial<CreateCustomerDTO>;

export interface CustomerResponse {
  success: boolean;
  data: Customer | Customer[] | null;
}
