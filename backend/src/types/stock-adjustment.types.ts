export type AdjustmentType =
  | "OPENING_STOCK"
  | "PHYSICAL_COUNT"
  | "DAMAGED"
  | "LOST"
  | "FOUND"
  | "MANUAL_CORRECTION"
  | "SAMPLE"
  | "RETURN_FROM_CUSTOMER";

export interface StockAdjustment {
  id: number;
  store_id: number;
  product_id: number;
  adjustment_type: AdjustmentType;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reason: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  product_name?: string;
  product_sku?: string;
}

export interface CreateStockAdjustmentDTO {
  product_id: number;
  adjustment_type: AdjustmentType;
  quantity_change?: number; // Signed change
  actual_count?: number; // Target total stock (used for PHYSICAL_COUNT)
  reason: string;
  notes?: string | null;
}
