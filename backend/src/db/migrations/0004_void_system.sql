ALTER TABLE "sales" ADD COLUMN "status" text DEFAULT 'COMPLETED' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "void_reason" text;
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "voided_by" text;
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "voided_at" timestamp;
