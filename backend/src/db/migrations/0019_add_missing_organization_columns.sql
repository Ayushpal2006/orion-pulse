-- Migration 0019: Add missing organization columns to PostgreSQL database
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pan_number text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Kolkata';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV-';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS financial_year text DEFAULT '2026-2027';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS receipt_info text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed integer DEFAULT 0 NOT NULL;
