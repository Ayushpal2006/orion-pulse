-- Multi-Tenant Foundation Migration (Phase 1: Organizations, Stores, User Store Access)

-- 1. Create user_store_access join table
CREATE TABLE IF NOT EXISTS "user_store_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- 2. Add Organization & Store foundation fields
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "organization_id" integer;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "code" text;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "is_default" integer DEFAULT 0 NOT NULL;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;

-- 3. Add Constraints & Foreign Keys
DO $$ BEGIN
  ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stores" ADD CONSTRAINT "stores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Add Indexes & Unique Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "idx_organizations_slug" ON "organizations" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_store_access_user_store" ON "user_store_access" ("user_id", "store_id");
CREATE INDEX IF NOT EXISTS "idx_user_store_access_user_id" ON "user_store_access" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_store_access_store_id" ON "user_store_access" ("store_id");
