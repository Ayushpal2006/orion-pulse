-- Migration 0011: Align purchase_orders, purchase_items, and suppliers tables with schema.ts

-- 1. Restore purchase_orders columns
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "po_number" text;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'COMPLETED' NOT NULL;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "expected_delivery" timestamp;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "gst" integer DEFAULT 0 NOT NULL;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "invoice_number" text;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "invoice_date" timestamp DEFAULT now();
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "transport_charges" integer DEFAULT 0 NOT NULL;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "other_charges" integer DEFAULT 0 NOT NULL;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "net_amount" integer DEFAULT 0 NOT NULL;

-- Populate po_number from purchase_number if purchase_number exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_orders' AND column_name='purchase_number') THEN
        UPDATE "purchase_orders" SET "po_number" = "purchase_number" WHERE "po_number" IS NULL OR "po_number" = '';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_orders' AND column_name='supplier_invoice_number') THEN
        UPDATE "purchase_orders" SET "invoice_number" = "supplier_invoice_number" WHERE "invoice_number" IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_orders' AND column_name='purchase_date') THEN
        UPDATE "purchase_orders" SET "invoice_date" = "purchase_date" WHERE "invoice_date" IS NULL;
    END IF;
END $$;

-- Fallback for any po_number that is still null
UPDATE "purchase_orders" SET "po_number" = 'PRCH-LEGACY-' || id WHERE "po_number" IS NULL OR "po_number" = '';

-- Ensure UNIQUE and NOT NULL constraint on po_number
ALTER TABLE "purchase_orders" ALTER COLUMN "po_number" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_purchase_orders_num" ON "purchase_orders" USING btree ("po_number");

-- 2. Restore purchase_items columns
ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "received_quantity" integer DEFAULT 0 NOT NULL;
ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "discount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "gst" integer DEFAULT 0 NOT NULL;

-- 3. Restore suppliers columns if missing
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "supplier_code" text DEFAULT 'SUP-000';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "company_name" text DEFAULT 'Supplier';
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "current_balance" integer DEFAULT 0 NOT NULL;
