export interface PurchaseItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity: number;
  purchase_price: number; // in paise
  selling_price: number; // in paise
  line_total: number; // in paise
  product_name?: string;
  product_sku?: string;
}

export interface PurchaseOrder {
  id: number;
  store_id: number;
  supplier_id: number;
  purchase_number: string;
  supplier_invoice_number: string | null;
  purchase_date: string;
  subtotal: number; // in paise
  discount: number; // in paise
  tax: number; // in paise
  grand_total: number; // in paise
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseItem[];
  supplier_name?: string;
}

export type CreatePurchaseItemDTO = {
  product_id: number;
  quantity: number;
  purchase_price: number; // in Rupees on payload, service converts to paise
  selling_price: number; // in Rupees on payload, service converts to paise
};

export type CreatePurchaseDTO = {
  supplier_id: number;
  supplier_invoice_number?: string | null;
  purchase_date?: string | null;
  discount?: number; // in Rupees on payload
  tax?: number; // in Rupees on payload
  payment_status: string;
  payment_method?: string | null;
  notes?: string | null;
  items: CreatePurchaseItemDTO[];
};

export type UpdatePurchaseDTO = Partial<CreatePurchaseDTO>;
