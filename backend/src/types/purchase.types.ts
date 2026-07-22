export interface PurchaseItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity: number;
  received_quantity?: number;
  purchase_price: number; // in paise
  discount?: number; // in paise
  gst?: number; // in paise
  line_total: number; // in paise
  product_name?: string;
  product_sku?: string;
}

export interface PurchaseOrder {
  id: number;
  store_id: number;
  supplier_id: number;
  po_number: string;
  purchase_number?: string;
  status?: string;
  expected_delivery?: string | null;
  subtotal: number; // in paise
  discount: number; // in paise
  gst: number; // in paise
  tax?: number;
  grand_total: number; // in paise
  invoice_number: string | null;
  supplier_invoice_number?: string | null;
  invoice_date: string;
  purchase_date?: string;
  transport_charges?: number;
  other_charges?: number;
  net_amount?: number;
  payment_status: string;
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
  discount?: number;
  gst?: number;
};

export type CreatePurchaseDTO = {
  supplier_id: number;
  po_number?: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  discount?: number; // in Rupees on payload
  gst?: number; // in Rupees on payload
  payment_status: string;
  notes?: string | null;
  items: CreatePurchaseItemDTO[];
};

export type UpdatePurchaseDTO = Partial<CreatePurchaseDTO>;
