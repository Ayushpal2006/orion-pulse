export interface CheckoutItemRequest {
  productId: number;
  quantity: number;
}

export interface CheckoutRequest {
  customerPhone: string;
  paymentMethod: "Cash" | "UPI" | "Card" | "Wallet";
  cashierName: string;
  items: CheckoutItemRequest[];
}

export interface Sale {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  cashier_name: string | null;
  payment_method: string;
  subtotal: number;
  discount: number;
  gst: number;
  grand_total: number;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  selling_price: number;
  discount: number;
  line_total: number;
}

export interface CheckoutResponse {
  success: boolean;
  invoice: string;
  saleId: number;
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  items: {
    productId: number;
    name: string;
    quantity: number;
    sellingPrice: number;
    lineTotal: number;
  }[];
}

export interface SaleDetailResponse {
  sale: Sale;
  customer: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
    notes: string | null;
  } | null;
  items: {
    id: number;
    sale_id: number;
    product_id: number;
    quantity: number;
    selling_price: number;
    discount: number;
    line_total: number;
    product_name: string;
    product_sku: string;
  }[];
  totals: {
    subtotal: number;
    discount: number;
    gst: number;
    grand_total: number;
  };
}
