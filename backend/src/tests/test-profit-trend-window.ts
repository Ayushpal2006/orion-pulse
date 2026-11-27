/**
 * Profit monthly trend window (LOCAL DB ONLY): returns at most the last 12 IST months, newest included,
 * and never a sale older than that. Regression for asc + limit(12) returning the oldest months.
 */
import assert from "assert";
import { env } from "../config/env";
import { getPool } from "../db";
import { storeStorage } from "../db/context";
import { profitRepository } from "../repositories";

const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!/^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }

async function main() {
  const pool = getPool();
  const inv = `PT-${Date.now()}`;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const prod = (await client.query("select id from products where organization_id=1 and store_id=1 limit 1")).rows[0];
    const old = (await client.query(
      `insert into sales (organization_id, store_id, invoice_number, subtotal, discount, gst, grand_total, paid_amount, payment_method, status, created_at)
       values (1, 1, $1, 100, 0, 0, 100, 100, 'Cash', 'COMPLETED', now() - interval '14 months') returning id`, [inv])).rows[0];
    await client.query(
      `insert into sale_items (organization_id, store_id, sale_id, product_id, quantity, selling_price, line_total)
       values (1, 1, $1, $2, 1, 100, 100)`, [old.id, prod.id]);
    await client.query("commit");

    const oldMonth = (await pool.query("select to_char(timezone('Asia/Kolkata', now() - interval '14 months'), 'Mon YYYY') m")).rows[0].m;
    const trend: any[] = await storeStorage.run({ organizationId: 1, currentStoreId: 1, userId: 1, role: "admin" } as any,
      () => profitRepository.getMonthlyTrend({ storeId: 1 } as any));
    const keys = trend.map((t) => t.label);
    assert.ok(trend.length <= 12, `got ${trend.length} months`);
    assert.ok(keys.length > 0 && !keys.includes(oldMonth), `14-month-old sale month ${oldMonth} must be excluded: ${keys}`);
    console.log(`✓ trend months: ${keys.join(", ")}`);
    console.log("🎉 PROFIT TREND WINDOW TEST PASSED");
  } finally {
    await pool.query("delete from sale_items where sale_id in (select id from sales where invoice_number=$1)", [inv]);
    await pool.query("delete from sales where invoice_number=$1", [inv]);
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
