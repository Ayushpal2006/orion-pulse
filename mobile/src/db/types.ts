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
