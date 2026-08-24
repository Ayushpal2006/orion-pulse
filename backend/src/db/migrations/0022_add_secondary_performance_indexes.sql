-- Phase 2 Secondary Performance Indexes Migration
CREATE INDEX IF NOT EXISTS "idx_customers_store_active" ON "customers" ("store_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_inv_adj_store_created" ON "inventory_adjustments" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_expenses_store_date" ON "expenses" ("store_id", "date");
