ALTER TABLE "supplier_payments" ADD COLUMN "payment_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "created_by" text DEFAULT 'System' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "current_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_supplier_ledger_store_id" ON "supplier_ledger" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_ledger_supplier_id" ON "supplier_ledger" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_store_id" ON "supplier_payments" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_supplier_id" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_number" ON "supplier_payments" USING btree ("payment_number");--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_payment_number_unique" UNIQUE("payment_number");