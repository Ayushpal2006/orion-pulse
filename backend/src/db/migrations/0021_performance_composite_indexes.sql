-- Phase 2 Performance Composite Indexes Migration
CREATE INDEX IF NOT EXISTS "idx_products_store_active" ON "products" ("store_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_sales_store_created" ON "sales" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_sales_store_status_created" ON "sales" ("store_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_sale_items_sale_product" ON "sale_items" ("sale_id", "product_id");
