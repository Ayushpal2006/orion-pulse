export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  category: string | null;
  purchase_price: number; // Stored in paise
  selling_price: number;  // Stored in paise
  stock: number;
  minimum_stock: number;
  gst: number;            // Percentage (default 18)
  is_active?: number;     // 1 = active, 0 = archived (soft deleted)
  created_at: string;
  updated_at: string;
}

export type CreateProductDTO = Omit<Product, "id" | "created_at" | "updated_at">;

export type UpdateProductDTO = Partial<CreateProductDTO>;
