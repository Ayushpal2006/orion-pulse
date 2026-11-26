/**
 * Real sync-route amount test (LOCAL DB ONLY). Mounts ONLY the real sync router (no full app)
 * and posts the exact payload shape the mobile app uploads (RUPEES). Asserts DB holds PAISE.
 */
import assert from "assert";
import http from "http";
import express from "express";
import { AddressInfo } from "net";
import { env } from "../config/env";
import { db, getPool } from "../db";
import { products } from "../db/schema";
import { storeStorage } from "../db/context";
import syncRouter from "../routes/sync.routes";

const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!/^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }

const RUN = `SA${Date.now().toString().slice(-7)}`;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  storeStorage.run({ organizationId: 1, currentStoreId: 1, userId: 1, role: "admin" } as any, () => next());
});
app.use("/api/sync", syncRouter);

async function post(base: string, body: any) {
  const r = await fetch(`${base}/api/sync/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, text: await r.text() };
}

async function main() {
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const mk = async (n: string, gst: number) => (await db.insert(products).values({
    organization_id: 1, store_id: 1, name: `${RUN}-${n}`, sku: `${RUN}-${n}`, purchase_price: 0, selling_price: 100, stock: 1000, gst, is_active: 1,
  } as any).returning())[0];
  const row = async (inv: string) => {
    const s = (await getPool().query("select id,subtotal,discount,gst,grand_total,paid_amount from sales where invoice_number=$1 and store_id=1", [inv])).rows;
    const it = s[0] ? (await getPool().query("select selling_price,discount,line_total from sale_items where sale_id=$1", [s[0].id])).rows : [];
    return { sales: s, items: it };
  };

  // Mobile outbox shape, GST 0 so ₹X in => ₹X out.
  for (const [r, p] of [[500, 50000], [1200, 120000], [1234, 123400], [9999, 999900], [10000, 1000000], [100000, 10000000]] as const) {
    const prod = await mk(`P${r}`, 0);
    const inv = `INV-OFFLINE-${RUN}-${r}`;
    const res = await post(base, { sales: [{
      invoice_number: inv, customer_phone: "0000000000", payment_method: "Cash",
      subtotal: r, discount: 0, gst: 0, tax: 0, grand_total: r, total_amount: r,
      items: [{ product_id: prod.id, product_name: prod.name, quantity: 1, selling_price: r, discount: 0, line_total: r }],
    }], customers: [] });
    assert.strictEqual(res.status, 200, res.text.slice(0, 300));
    const d = await row(inv);
    assert.strictEqual(d.sales.length, 1);
    assert.strictEqual(Number(d.sales[0].grand_total), p, `sync grand_total ₹${r}`);
    assert.strictEqual(Number(d.sales[0].subtotal), p);
    assert.strictEqual(Number(d.items[0].selling_price), p);
    assert.strictEqual(Number(d.items[0].line_total), p);
    // displayed amount = paise / 100 (how receipts/reports render)
    assert.strictEqual(Number(d.sales[0].grand_total) / 100, r);
    console.log(`PASS sync ₹${r} -> ${d.sales[0].grand_total} paise -> ₹${Number(d.sales[0].grand_total) / 100}`);
  }

  // ₹1200 - ₹200 + 18% GST, mobile shape (rupees everywhere)
  const g = await mk("GST", 18);
  const inv = `INV-OFFLINE-${RUN}-GST`;
  const res = await post(base, { sales: [{
    invoice_number: inv, customer_phone: "0000000000", payment_method: "Cash",
    subtotal: 1200, discount: 200, gst: 216, tax: 216, grand_total: 1216, total_amount: 1216, amount_paid: 1216,
    items: [{ product_id: g.id, product_name: g.name, quantity: 1, selling_price: 1200, discount: 0, discount_percent: 0, discount_amount: 0, line_total: 1200 }],
  }], customers: [] });
  assert.strictEqual(res.status, 200, res.text.slice(0, 300));
  const d = await row(inv);
  assert.deepStrictEqual(
    [d.sales[0].subtotal, d.sales[0].discount, d.sales[0].gst, d.sales[0].grand_total, d.sales[0].paid_amount].map(Number),
    [120000, 20000, 21600, 121600, 121600]);
  console.log("PASS sync ₹1200 - ₹200 + GST 216 => 121600 paise");

  // Line discount is a PERCENT (mobile legacy `discount`), must not be converted as currency.
  const pc = await mk("PCT", 0);
  const inv2 = `INV-OFFLINE-${RUN}-PCT`;
  const r2 = await post(base, { sales: [{ invoice_number: inv2, customer_phone: "0000000000", payment_method: "Cash",
    subtotal: 1000, discount: 100, gst: 0, grand_total: 900, total_amount: 900,
    items: [{ product_id: pc.id, product_name: pc.name, quantity: 2, selling_price: 500, discount: 10, line_total: 900 }] }], customers: [] });
  assert.strictEqual(r2.status, 200, r2.text.slice(0, 300));
  const d2 = await row(inv2);
  assert.strictEqual(Number(d2.items[0].discount), 10000, "10% of ₹1000 = ₹100 = 10000 paise");
  console.log("PASS sync line discount 10% => 10000 paise (percent not treated as currency)");

  // Idempotency: same invoice again must not create a duplicate.
  await post(base, { sales: [{ invoice_number: inv, customer_phone: "0000000000", payment_method: "Cash", subtotal: 1200, grand_total: 1216, items: [] }] });
  assert.strictEqual((await row(inv)).sales.length, 1);
  console.log("PASS sync duplicate invoice ignored");

  server.close();
  console.log("ALL PASSED");
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; }).finally(async () => { await getPool().end().catch(() => {}); process.exit(process.exitCode || 0); });
