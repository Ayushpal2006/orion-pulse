-- Phase 2 Multi-Tenant Migration: Seed Default Organization & Main Store (First Tenant Initialization)

DO $$
DECLARE
  default_org_id integer;
BEGIN
  -- 1. Insert default Organization if no organization exists
  INSERT INTO "organizations" ("id", "name", "slug", "status", "billing_plan", "subscription_status")
  VALUES (1, 'Apka Bill Demo', 'apka-bill-demo', 'active', 'Enterprise', 'active')
  ON CONFLICT ("id") DO NOTHING;

  -- Retrieve the default organization ID (either id 1 or existing first organization)
  SELECT "id" INTO default_org_id FROM "organizations" ORDER BY "id" ASC LIMIT 1;

  -- 2. Insert or update default Main Store (id = 1)
  IF default_org_id IS NOT NULL THEN
    INSERT INTO "stores" ("id", "organization_id", "name", "code", "is_default", "status")
    VALUES (1, default_org_id, 'Main Store', 'MAIN-01', 1, 'active')
    ON CONFLICT ("id") DO UPDATE SET
      "organization_id" = COALESCE("stores"."organization_id", EXCLUDED."organization_id"),
      "is_default" = 1;

    -- Update any existing stores that lack an organization_id
    UPDATE "stores"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    -- Update existing users to link to default organization
    UPDATE "users"
    SET "organization_id" = default_org_id
    WHERE "organization_id" IS NULL;

    -- Populate user_store_access for existing users and stores idempotently
    INSERT INTO "user_store_access" ("user_id", "store_id")
    SELECT u."id", s."id"
    FROM "users" u
    CROSS JOIN "stores" s
    ON CONFLICT ("user_id", "store_id") DO NOTHING;
  END IF;
END $$;
