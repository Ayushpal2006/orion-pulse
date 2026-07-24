CREATE TABLE IF NOT EXISTS "product_cost_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"average_cost" integer NOT NULL,
	"effective_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_cost_history_store_id_stores_id_fk') THEN
        ALTER TABLE "product_cost_history" ADD CONSTRAINT "product_cost_history_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_cost_history_product_id_products_id_fk') THEN
        ALTER TABLE "product_cost_history" ADD CONSTRAINT "product_cost_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_pch_store_id" ON "product_cost_history" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "idx_pch_product_id" ON "product_cost_history" USING btree ("product_id");
CREATE INDEX IF NOT EXISTS "idx_pch_effective_date" ON "product_cost_history" USING btree ("effective_date");
