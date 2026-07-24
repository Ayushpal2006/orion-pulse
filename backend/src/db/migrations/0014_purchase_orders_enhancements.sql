ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "payment_method" text DEFAULT 'Cash';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "void_reason" text;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "voided_by" text;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "voided_at" timestamp;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "created_by" text DEFAULT 'System';
