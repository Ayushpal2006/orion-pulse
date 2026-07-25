import { pool } from "../db";

async function alignDbSchema() {
  console.log("=== ALIGNING DATABASE SCHEMA COLUMNS ===");

  const queries = [
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone text;`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email text;`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gst_number text;`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pan_number text;`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address text;`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Kolkata';`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV-';`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS financial_year text DEFAULT '2026-2027';`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS receipt_info text;`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_plan text DEFAULT 'Basic';`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active';`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed integer DEFAULT 0;`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id integer;`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id integer;`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active integer DEFAULT 1;`
  ];

  for (const q of queries) {
    try {
      await pool.query(q);
    } catch (err: any) {
      console.warn("Schema query info:", err.message);
    }
  }

  console.log("✅ Database schema alignment completed successfully.");
  process.exit(0);
}

alignDbSchema().catch((err) => {
  console.error("Schema alignment error:", err);
  process.exit(1);
});
