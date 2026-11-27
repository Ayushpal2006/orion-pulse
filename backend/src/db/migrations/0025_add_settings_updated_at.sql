-- Lets sync delta pulls skip unchanged settings. Without it every mobile pull re-sent every row,
-- including ~400 KB data-URL logos (850 KB per pull for one store, 2026-11-27).
-- Additive. now() is not volatile, so Postgres stores the default without rewriting the table.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
