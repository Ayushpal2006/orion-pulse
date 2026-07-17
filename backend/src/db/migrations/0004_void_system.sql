ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'COMPLETED' NOT NULL;

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "void_reason" text;

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "voided_by" text;

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "voided_at" timestamp;
