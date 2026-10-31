-- Migration: 0023_add_kot_tables_and_kitchen_flag
-- Safety: Additive, non-destructive, backward-compatible

-- 1. Add is_kitchen_item to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_kitchen_item" integer DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_products_kitchen" ON "products" ("store_id", "is_kitchen_item");

-- 2. Create kots table
CREATE TABLE IF NOT EXISTS "kots" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
	"store_id" integer NOT NULL REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
	"sale_id" integer NOT NULL REFERENCES "sales"("id") ON DELETE cascade ON UPDATE NO ACTION,
	"kot_number" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"table_no" text,
	"order_type" text DEFAULT 'DINE_IN' NOT NULL,
	"notes" text,
	"printed_at" timestamp,
	"reprint_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_kots_organization_id" ON "kots" ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_kots_store_kot_number" ON "kots" ("store_id", "kot_number");
CREATE INDEX IF NOT EXISTS "idx_kots_sale_id" ON "kots" ("sale_id");
CREATE INDEX IF NOT EXISTS "idx_kots_store_status" ON "kots" ("store_id", "status");
CREATE INDEX IF NOT EXISTS "idx_kots_store_created" ON "kots" ("store_id", "created_at");

-- 3. Create kot_items table
CREATE TABLE IF NOT EXISTS "kot_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
	"store_id" integer REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
	"kot_id" integer NOT NULL REFERENCES "kots"("id") ON DELETE cascade ON UPDATE NO ACTION,
	"product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
	"quantity" integer NOT NULL,
	"product_name_snapshot" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_kot_items_organization_id" ON "kot_items" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_kot_items_store_id" ON "kot_items" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_kot_items_kot_id" ON "kot_items" ("kot_id");
CREATE INDEX IF NOT EXISTS "idx_kot_items_product_id" ON "kot_items" ("product_id");

-- 4. Create store_kot_sequences table for concurrency-safe atomic KOT numbering
CREATE TABLE IF NOT EXISTS "store_kot_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
	"last_kot_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_store_kot_sequences_store_id" ON "store_kot_sequences" ("store_id");
