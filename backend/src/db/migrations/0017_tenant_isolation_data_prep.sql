-- Phase 3 Multi-Tenant Migration: Tenant Isolation Data Prep (Nullable organization_id and store_id columns, FKs, and Indexes)

-- Add organization_id & store_id columns
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "organization_id" integer;
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "store_id" integer;

ALTER TABLE "returns" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "organization_id" integer;
ALTER TABLE "return_items" ADD COLUMN IF NOT EXISTS "store_id" integer;

ALTER TABLE "inventory_logs" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "organization_id" integer;
ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "store_id" integer;

ALTER TABLE "supplier_payments" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "supplier_ledger" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "inventory_adjustments" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "device_settings" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "backup_history" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "sync_history" ADD COLUMN IF NOT EXISTS "organization_id" integer;

ALTER TABLE "product_cost_history" ADD COLUMN IF NOT EXISTS "organization_id" integer;

-- Foreign Keys
DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "returns" ADD CONSTRAINT "returns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "return_items" ADD CONSTRAINT "return_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "return_items" ADD CONSTRAINT "return_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "product_cost_history" ADD CONSTRAINT "product_cost_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_products_organization_id" ON "products" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_customers_organization_id" ON "customers" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_sales_organization_id" ON "sales" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_sale_items_organization_id" ON "sale_items" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_sale_items_store_id" ON "sale_items" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_returns_organization_id" ON "returns" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_return_items_organization_id" ON "return_items" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_return_items_store_id" ON "return_items" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_inv_logs_organization_id" ON "inventory_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_inv_mov_organization_id" ON "inventory_movements" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_suppliers_organization_id" ON "suppliers" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_organization_id" ON "purchase_orders" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_items_organization_id" ON "purchase_items" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_purchase_items_store_id" ON "purchase_items" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_payments_organization_id" ON "supplier_payments" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_ledger_organization_id" ON "supplier_ledger" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_inv_adj_organization_id" ON "inventory_adjustments" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_expense_categories_organization_id" ON "expense_categories" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_expenses_organization_id" ON "expenses" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_pch_organization_id" ON "product_cost_history" ("organization_id");
