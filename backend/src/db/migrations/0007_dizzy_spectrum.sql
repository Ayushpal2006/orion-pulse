ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_po_number_unique";--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "selling_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "purchase_number" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "supplier_invoice_number" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "purchase_date" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "tax" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "payment_method" text;--> statement-breakpoint

-- Drop old columns on purchase_orders
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "po_number";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "expected_delivery";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "net_amount";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "gst";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "invoice_number";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "invoice_date";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "transport_charges";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "other_charges";--> statement-breakpoint

-- Drop old columns on purchase_items
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "received_quantity";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "discount";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "gst";--> statement-breakpoint

-- Re-create indexes
CREATE INDEX IF NOT EXISTS "idx_purchase_items_po_id" ON "purchase_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_items_prod_id" ON "purchase_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_store_id" ON "purchase_orders" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_supplier_id" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_num" ON "purchase_orders" USING btree ("purchase_number");