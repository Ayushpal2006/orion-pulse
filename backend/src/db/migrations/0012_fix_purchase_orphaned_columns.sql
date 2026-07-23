-- Migration 0012: Complete the purchase-flow schema reconciliation started in 0011.
--
-- Root cause: migrations 0006-0008 performed a suppliers/purchase_orders/purchase_items
-- refactor that was later abandoned (schema.ts was reverted, but the migration files
-- were not). Migration 0011 partially re-aligned purchase_orders/purchase_items/suppliers
-- with schema.ts, but left two orphaned NOT NULL columns with no defaults that the
-- current code never populates, and never restored several suppliers columns that
-- schema.ts still declares. Both break every POST /api/purchases request.

-- 1. Restore suppliers columns declared in schema.ts but dropped by migration 0006
--    (only supplier_code/company_name/current_balance were restored by 0011).
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contact_person" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gst_number" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "pan_number" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "postal_code" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "opening_balance" integer DEFAULT 0 NOT NULL;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "payment_terms" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "credit_limit" integer DEFAULT 0 NOT NULL;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "is_active" integer DEFAULT 1 NOT NULL;

-- 2. Drop orphaned purchase_orders.purchase_number: added NOT NULL by migration 0007,
--    its DEFAULT was dropped by migration 0008, it is not declared in schema.ts, and
--    the current insert (purchase.repository.ts) never supplies it. Every purchase
--    creation fails with: null value in column "purchase_number" violates not-null
--    constraint (23502).
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "purchase_number";

-- 3. Drop orphaned purchase_items.selling_price: same lineage as above (added NOT NULL
--    in 0007, default dropped in 0008), not declared in schema.ts, never populated by
--    the repository insert. Fails with the same 23502 error once step 2 is fixed.
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "selling_price";

-- 4. Re-create the unique index on po_number. Migration 0011 attempted this, but the
--    index name "idx_purchase_orders_num" was still held by the old (non-unique) index
--    on purchase_number from migration 0007, so "CREATE ... IF NOT EXISTS" silently
--    skipped it and po_number was left without its uniqueness guarantee. Dropping
--    purchase_number above (step 2) frees the name.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_purchase_orders_num" ON "purchase_orders" USING btree ("po_number");
