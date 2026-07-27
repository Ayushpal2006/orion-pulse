-- Migration 0020: Add system customer columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS type text DEFAULT 'REGULAR' NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_system integer DEFAULT 0 NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_protected integer DEFAULT 0 NOT NULL;
ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;
