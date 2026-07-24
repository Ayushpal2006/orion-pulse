CREATE TABLE "stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"adjustment_type" text NOT NULL,
	"quantity_before" integer NOT NULL,
	"quantity_change" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"created_by" text DEFAULT 'System' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "selling_price" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "purchase_number" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stock_adjustments_store_id" ON "stock_adjustments" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_stock_adjustments_product_id" ON "stock_adjustments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_stock_adjustments_type" ON "stock_adjustments" USING btree ("adjustment_type");--> statement-breakpoint
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "received_quantity";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "discount";--> statement-breakpoint
ALTER TABLE "purchase_items" DROP COLUMN IF EXISTS "gst";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "po_number";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "expected_delivery";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "net_amount";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "gst";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "invoice_number";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "invoice_date";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "transport_charges";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "other_charges";--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_number_unique" UNIQUE("purchase_number");