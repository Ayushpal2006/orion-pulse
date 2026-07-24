-- Phase 4 Multi-Tenant Migration: Backfill existing production records with Default Organization & Default Store

DO $$
DECLARE
  default_org_id integer;
  default_store_id integer;
BEGIN
  -- 1. Fetch default organization ID dynamically
  SELECT "id" INTO default_org_id FROM "organizations" ORDER BY "id" ASC LIMIT 1;

  -- 2. Fetch default store ID dynamically (prefer is_default = 1, fallback to first store)
  SELECT "id" INTO default_store_id FROM "stores" WHERE "is_default" = 1 ORDER BY "id" ASC LIMIT 1;

  IF default_store_id IS NULL THEN
    SELECT "id" INTO default_store_id FROM "stores" ORDER BY "id" ASC LIMIT 1;
  END IF;

  -- Verify both IDs are present before proceeding with backfill
  IF default_org_id IS NOT NULL AND default_store_id IS NOT NULL THEN
    -- Backfill products
    UPDATE "products"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "products"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill customers
    UPDATE "customers"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "customers"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill suppliers
    UPDATE "suppliers"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "suppliers"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill sales
    UPDATE "sales"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "sales"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill sale_items
    UPDATE "sale_items"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "sale_items"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill returns
    UPDATE "returns"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "returns"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill return_items
    UPDATE "return_items"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "return_items"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill purchase_orders
    UPDATE "purchase_orders"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "purchase_orders"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill purchase_items
    UPDATE "purchase_items"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "purchase_items"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill supplier_payments
    UPDATE "supplier_payments"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "supplier_payments"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill supplier_ledger
    UPDATE "supplier_ledger"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "supplier_ledger"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill expense_categories
    UPDATE "expense_categories"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "expense_categories"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill expenses
    UPDATE "expenses"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "expenses"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill inventory_logs
    UPDATE "inventory_logs"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "inventory_logs"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill inventory_movements
    UPDATE "inventory_movements"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "inventory_movements"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill inventory_adjustments
    UPDATE "inventory_adjustments"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "inventory_adjustments"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill device_settings
    UPDATE "device_settings"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "device_settings"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill backup_history
    UPDATE "backup_history"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "backup_history"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill audit_logs
    UPDATE "audit_logs"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "audit_logs"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill sync_history
    UPDATE "sync_history"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "sync_history"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;

    -- Backfill product_cost_history
    UPDATE "product_cost_history"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    UPDATE "product_cost_history"
    SET "store_id" = default_store_id
    WHERE "store_id" IS NULL;
  END IF;
END $$;
