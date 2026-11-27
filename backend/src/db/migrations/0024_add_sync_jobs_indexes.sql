-- sync_jobs indexes declared in schema.ts but never created by a migration (prod had only the pkey;
-- 6.3k seq scans / 33M tuples read by 2026-11-27). Additive, idempotent. Table is ~12k rows, so a
-- plain CREATE INDEX locks writes for milliseconds.
CREATE INDEX IF NOT EXISTS "idx_sync_jobs_organization_id" ON "sync_jobs" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_jobs_store_id" ON "sync_jobs" ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_jobs_status" ON "sync_jobs" ("status");
