ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_supplier_code_unique";--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "gstin" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "is_archived" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "supplier_code";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "company_name";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "contact_person";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "gst_number";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "pan_number";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "city";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "state";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "country";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "postal_code";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "opening_balance";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "current_balance";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "payment_terms";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "credit_limit";--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "is_active";--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_suppliers_store_id" ON "suppliers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suppliers_name" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suppliers_phone" ON "suppliers" USING btree ("store_id","phone");