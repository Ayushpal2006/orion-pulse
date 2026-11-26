// Local-only check of scripts/repair-offline-sale-amounts.ts: dry run, apply, idempotent re-run, rollback.
import assert from "node:assert/strict";
import fs from "node:fs";
import { Pool } from "pg";
import { classifySale } from "../scripts/repair-offline-sale-amounts";

const url = process.env.DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }
const pool = new Pool({ connectionString: url });
const RUN = `RPT${Date.now().toString().slice(-7)}`;

function run(...args: string[]) {
  const p = Bun.spawnSync(["bun", "run", "src/scripts/repair-offline-sale-amounts.ts", ...args], { env: { ...process.env, DATABASE_URL: url } });
  const out = p.stdout.toString() + p.stderr.toString();
  assert.equal(p.exitCode, 0, out);
  return out;
}

async function sale(inv: string, rupeeScale: boolean, productId: number, discount = 0) {
  const k = rupeeScale ? 1 : 100; // buggy rows hold rupees in paise columns
  const [s] = (await pool.query(
    `insert into sales (organization_id, store_id, invoice_number, cashier_name, payment_method, subtotal, discount, gst, grand_total, paid_amount, balance, status)
     values (1, 1, $1, 'Offline Client', 'Cash', $2, 0, 0, $2, $2, 0, 'COMPLETED') returning id`, [inv, 500 * k])).rows;
  await pool.query(`insert into sale_items (organization_id, store_id, sale_id, product_id, quantity, selling_price, discount, line_total)
     values (1, 1, $1, $2, 1, $3, $4, $3)`, [s.id, productId, 500 * k, discount]);
  return s.id as number;
}
const total = async (id: number) => Number((await pool.query("select grand_total from sales where id=$1", [id])).rows[0].grand_total);
const itemPrice = async (id: number) => Number((await pool.query("select selling_price from sale_items where sale_id=$1", [id])).rows[0].selling_price);

async function main() {
  assert.equal(classifySale([{ selling_price: 500, product_price: 50000, discount: 0 }], false).classification, "AFFECTED");
  assert.equal(classifySale([{ selling_price: 50000, product_price: 50000, discount: 0 }], false).classification, "OK");
  assert.equal(classifySale([{ selling_price: 500, product_price: 50000, discount: 10 }], false).classification, "REVIEW");
  assert.equal(classifySale([{ selling_price: 500, product_price: 50000, discount: 0 }], true).classification, "REVIEW");
  assert.equal(classifySale([], false).classification, "REVIEW");

  const [prod] = (await pool.query(
    `insert into products (organization_id, store_id, name, sku, purchase_price, selling_price, stock, gst, is_active)
     values (1, 1, $1, $1, 0, 50000, 100, 0, 1) returning id`, [`${RUN}-P`])).rows;
  const bad = await sale(`INV-OFFLINE-${RUN}-BAD`, true, prod.id);
  const good = await sale(`INV-OFFLINE-${RUN}-OK`, false, prod.id);
  const disc = await sale(`INV-OFFLINE-${RUN}-DISC`, true, prod.id, 10);

  const dry = run();
  assert.match(dry, new RegExp(`AFFECTED sale ${bad} `));
  assert.match(dry, new RegExp(`REVIEW   sale ${disc} `));
  assert.ok(!new RegExp(`sale ${good} `).test(dry), "correct sale must not be listed");
  assert.equal(await total(bad), 500, "dry run must not write");

  const applied = run("--apply");
  const backup = applied.match(/Backup written: (\S+)/)?.[1];
  assert.ok(backup && fs.existsSync(backup));
  assert.equal(await total(bad), 50000);
  assert.equal(await itemPrice(bad), 50000);
  assert.equal(await total(good), 50000, "correct sale untouched");
  assert.equal(await total(disc), 500, "review sale untouched");

  const again = run("--apply");
  assert.ok(!new RegExp(`AFFECTED sale ${bad} `).test(again), "second run must not re-scale");
  assert.equal(await total(bad), 50000);

  run("--rollback", backup!);
  assert.equal(await total(bad), 500);
  assert.equal(await itemPrice(bad), 500);
  fs.unlinkSync(backup!);
  console.log("ALL PASSED: classify, dry run, apply, idempotent re-run, rollback");
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; }).finally(() => pool.end());
