export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  total_orders: number;
  lifetime_value: number; // stored in paise (paise = Rs * 100)
  last_visit: string | null; // DATETIME ISO/SQL String
  created_at: string;
  updated_at: string;
}

export type CreateCustomerDTO = Omit<
  Customer,
  "id" | "total_orders" | "lifetime_value" | "last_visit" | "created_at" | "updated_at"
> & {
  total_orders?: number;
  lifetime_value?: number;
  last_visit?: string | null;
};

export type UpdateCustomerDTO = Partial<CreateCustomerDTO>;

export interface CustomerResponse {
  success: boolean;
  data: Customer | Customer[] | null;
}
