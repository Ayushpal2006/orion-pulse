/**
 * Sync integrity test (LOCAL DB ONLY). Mounts only the real sync router.
 * 1. Concurrent uploads of the same offline invoice (a client retry racing a slow first request)
 *    must produce exactly one sale.
 * 2. A pull with no paging params (the shipped Expo client) must return the whole delta and a
 *    current syncTime, even when there are more rows than the default page size.
 * 3. A pull with pageSize still pages and reports hasMore.
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
import { settingsRepository } from "../repositories";

const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!/^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }

const RUN = `SI${Date.now().toString().slice(-7)}`;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  storeStorage.run({ organizationId: 1, currentStoreId: 1, userId: 1, role: "admin" } as any, () => next());
});
app.use("/api/sync", syncRouter);

async function main() {
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const [prod] = await db.insert(products).values({
    organization_id: 1, store_id: 1, name: `${RUN}-P`, sku: `${RUN}-P`, purchase_price: 0, selling_price: 100, stock: 1000, gst: 0, is_active: 1,
  } as any).returning();

  // 1. Same invoice uploaded 5 times concurrently.
  const inv = `INV-OFFLINE-${RUN}-DUP`;
  const body = JSON.stringify({ sales: [{
    invoice_number: inv, customer_phone: "0000000000", payment_method: "Cash",
    subtotal: 100, discount: 0, gst: 0, tax: 0, grand_total: 100, total_amount: 100,
    items: [{ product_id: prod.id, product_name: prod.name, quantity: 1, selling_price: 100, discount: 0, line_total: 100 }],
  }], customers: [] });
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    fetch(`${base}/api/sync/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body }).then((r) => r.status)));
  assert.ok(results.every((s) => s === 200), `upload statuses ${results}`);
  const dup = (await getPool().query("select count(*)::int n from sales where invoice_number=$1 and store_id=1", [inv])).rows[0].n;
  assert.strictEqual(dup, 1, `expected 1 sale for ${inv}, got ${dup}`);
  console.log("✓ concurrent duplicate uploads stored once");

  // 2/3. Pull with and without paging params.
  const total = (await getPool().query("select count(*)::int n from sales where organization_id=1 and store_id=1")).rows[0].n;
  const legacy = await (await fetch(`${base}/api/sync/download`)).json() as any;
  assert.strictEqual(legacy.data.sales.length, total, `legacy pull returned ${legacy.data.sales.length}/${total} sales`);
  assert.strictEqual(legacy.data.hasMore ?? legacy.hasMore ?? false, false);
  const st = legacy.data.syncTime || legacy.data.sync?.syncTime;
  assert.ok(st && !st.startsWith("1970"), `legacy syncTime should be current, got ${st}`);
  console.log(`✓ legacy pull returned all ${total} sales with current syncTime`);

  if (total > 1) {
    const paged = await (await fetch(`${base}/api/sync/download?pageSize=1`)).json() as any;
    assert.strictEqual(paged.data.sales.length, 1);
    assert.strictEqual(paged.data.hasMore ?? paged.hasMore, true);
    console.log("✓ paging client still paged");
  }

  // 4. Delta pulls send a setting only when its value changed (logos are ~400 KB).
  const ctx = { organizationId: 1, currentStoreId: 1, userId: 1, role: "admin" } as any;
  const key = `si_test_${RUN}`;
  const keysAfter = async (since: string) => {
    const r = await (await fetch(`${base}/api/sync/download?lastSyncTime=${encodeURIComponent(since)}`)).json() as any;
    return (r.data.settings as any[]).map((x) => x.key);
  };
  await storeStorage.run(ctx, () => settingsRepository.set(key, "v1"));
  await new Promise((r) => setTimeout(r, 20));
  const t1 = new Date().toISOString();
  assert.ok(!(await keysAfter(t1)).includes(key), "unchanged setting must not be re-sent");
  await storeStorage.run(ctx, () => settingsRepository.set(key, "v1"));
  assert.ok(!(await keysAfter(t1)).includes(key), "re-saving the same value must not re-send it");
  await storeStorage.run(ctx, () => settingsRepository.set(key, "v2"));
  assert.ok((await keysAfter(t1)).includes(key), "changed setting must be sent");
  await getPool().query("delete from settings where key=$1", [key]);
  console.log("✓ delta pull sends only changed settings");

  server.close();
  await getPool().end();
  console.log("🎉 SYNC INTEGRITY TESTS PASSED");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
