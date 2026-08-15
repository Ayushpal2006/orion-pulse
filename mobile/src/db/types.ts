/**
 * Apka Bill Mobile - Local SQLite Database Entity Types
 *
 * Aligned with existing backend schemas and REST API contracts.
 */

export interface LocalStore {
  id: number; // Server identifier
  organization_id: number | null;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  gst_number?: string | null;
  phone?: string | null;
  currency?: string;
  timezone?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LocalProduct {
  id: number; // Server identifier
  organization_id?: number | null;
  store_id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  category?: string | null;
  selling_price: number; // Integer (paise or major unit depending on backend)
  purchase_price?: number;
  stock: number;
  minimum_stock?: number;
  gst?: number;
  is_active: number; // 1 = active, 0 = inactive
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LocalCustomer {
  id: number; // Server identifier
  organization_id?: number | null;
  store_id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  total_orders?: number;
  lifetime_value?: number;
  is_active?: number; // 1 = active, 0 = inactive
  created_at?: string;
  updated_at?: string;
}

export interface LocalSale {
  local_id: string; // Stable UUID / local ID
  server_id?: number | null;
  local_invoice_number: string;
  invoice_number?: string | null;
  organization_id?: number | null;
  store_id: number;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  cashier_name?: string | null;
  payment_method: string;
  payment_details?: string | null;
  subtotal: number;
  discount: number;
  gst: number;
  grand_total: number;
  paid_amount: number;
  balance: number;
  status: 'COMPLETED' | 'VOID';
  sync_status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  created_at: string;
  updated_at: string;
}

export interface LocalSaleItem {
  local_id: string;
  sale_local_id: string;
  product_id: number;
  product_name: string;
  quantity: number;
  selling_price: number;
  discount: number;
  gst: number;
  line_total: number;
  created_at: string;
}

export interface LocalPayment {
  local_id: string;
  sale_local_id: string;
  payment_method: string;
  amount: number;
  reference?: string | null;
  status: string;
  created_at: string;
}

export interface LocalInventoryMovement {
  local_id: string;
  organization_id?: number | null;
  store_id: number;
  product_id: number;
  sale_local_id?: string | null;
  movement_type: string; // 'SALE', 'VOID', 'ADJUSTMENT'
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_id: string;
  created_at: string;
}

export interface CartItem {
  product: LocalProduct;
  quantity: number;
  discount?: number; // Line discount in integer paise
}

export interface CheckoutRequest {
  storeId: number;
  organizationId?: number | null;
  items: CartItem[];
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  cashierName?: string | null;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Split' | 'Credit' | 'Wallet';
  discount?: number; // Overall sale discount
  paidAmount?: number;
  paymentReference?: string | null;
}

export interface CheckoutTotals {
  subtotal: number;
  itemDiscounts: number;
  totalGst: number;
  saleDiscount: number;
  grandTotal: number;
  paidAmount: number;
  balance: number;
}

export interface CheckoutResult {
  success: boolean;
  sale?: LocalSale;
  items?: LocalSaleItem[];
  payment?: LocalPayment;
  totals?: CheckoutTotals;
  error?: string;
}

export interface SyncQueueItem {
  id: string; // UUID
  entity_type: 'SALE' | 'CUSTOMER' | 'ADJUSTMENT';
  entity_local_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  idempotency_key: string; // `${storeId}-${local_sale_id}`
  payload: string; // JSON string
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  attempts: number;
  next_attempt_at: string;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Migration {
  id: number;
  name: string;
  up: (db: DatabaseExecutor) => Promise<void>;
  down?: (db: DatabaseExecutor) => Promise<void>;
}

export interface DatabaseExecutor {
  executeSql: (sql: string, params?: any[]) => Promise<any>;
  getAll: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  getFirst: <T = any>(sql: string, params?: any[]) => Promise<T | null>;
  transaction: <T = void>(fn: (tx: DatabaseExecutor) => Promise<T>) => Promise<T>;
}
