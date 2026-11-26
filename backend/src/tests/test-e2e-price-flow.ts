/**
 * End-to-end price-unit regression (LOCAL DB ONLY). Fails if ANY layer treats 1234 as paise.
 *
 * Product save (web mapper) -> DB paise -> product list API (raw) -> web mapper (rupees) ->
 * cart line -> checkout DTO exactly as billing builds it -> CheckoutService -> DB paise ->
 * sale response (rupees) -> receipt (rupees).
 * Prints VALUE + UNIT at every stage.
 */
import assert from "assert";
import { env } from "../config/env";
import { db, getPool } from "../db";
import { products } from "../db/schema";
import { storeStorage } from "../db/context";
import { CheckoutService } from "../services/checkout.service";
import { mapFrontendProductToBackend, mapBackendProductToFrontend } from "../../../frontend/src/lib/api";

const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!/^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }

const RUN = `E2E${Date.now().toString().slice(-7)}`;
const say = (stage: string, v: any, unit: string) => console.log(`  ${stage.padEnd(24)} ${String(v).padStart(10)}  ${unit}`);

async function flow(rupees: number) {
  const paise = rupees * 100;
  console.log(`--- ₹${rupees} ---`);
  // 1. Product save: web form (rupees) -> backend body
  const body = mapFrontendProductToBackend({ name: `${RUN}-${rupees}`, sku: `${RUN}-${rupees}`, price: rupees, purchase: 0, gst: 0, stock: 100 } as any);
  say("WEB FORM", rupees, "rupees");
  say("PRODUCT SAVE BODY", body.selling_price, "paise");
  assert.strictEqual(body.selling_price, paise, "web mapper must send paise");
  const [row] = await db.insert(products).values({ organization_id: 1, store_id: 1, name: body.name, sku: body.sku,
    purchase_price: body.purchase_price, selling_price: body.selling_price, stock: 100, gst: 0, is_active: 1 } as any).returning();
  say("PRODUCT DB", row.selling_price, "paise");
  assert.strictEqual(Number(row.selling_price), paise);
  // 2. Product list API returns raw row (paise) -> web mapper -> rupees
  const apiRow = (await getPool().query("select * from products where id=$1", [row.id])).rows[0];
  const ui = mapBackendProductToFrontend(apiRow);
  say("PRODUCT API ROW", apiRow.selling_price, "paise");
  say("UI PRODUCT/CART PRICE", ui.price, "rupees");
  assert.strictEqual(ui.price, rupees, "UI must show rupees");
  // 3. Checkout DTO as billing.lazy.tsx builds it
  const dto: any = { customerPhone: "0000000000", paymentMethod: "Cash", cashierName: "Admin",
    items: [{ productId: Number(ui.id), quantity: 1, unitPrice: ui.price, price: ui.price, discount: 0, discountPercent: 0 }] };
  say("CHECKOUT REQUEST", dto.items[0].unitPrice, "rupees");
  // 4. Backend
  const res: any = await new CheckoutService().executeCheckout(dto);
  const sale = (await getPool().query("select subtotal,grand_total from sales where id=$1", [res.saleId])).rows[0];
  const item = (await getPool().query("select selling_price,line_total from sale_items where sale_id=$1", [res.saleId])).rows[0];
  say("SALE DB grand_total", sale.grand_total, "paise");
  say("SALE_ITEM DB price", item.selling_price, "paise");
  say("SALE RESPONSE", res.grandTotal, "rupees");
  assert.strictEqual(Number(sale.grand_total), paise);
  assert.strictEqual(Number(item.selling_price), paise);
  assert.strictEqual(res.grandTotal, rupees);
  assert.strictEqual(res.subtotal, rupees);
  // 5. Receipt/report display conversion (paise / 100), same formula as receipt-builder and reports
  const shown = Number(sale.grand_total) / 100;
  say("RECEIPT / REPORT", `₹${shown}`, "display");
  assert.strictEqual(shown, rupees);
}

async function main() {
  await storeStorage.run({ organizationId: 1, currentStoreId: 1, userId: 1, role: "admin" } as any, async () => {
    for (const r of [500, 1200, 1234, 9999, 10000, 100000]) await flow(r);
  });
  console.log("ALL PASSED");
}
main().catch((e) => { console.error("FAILED:", e.message.slice(0, 200), "| CAUSE:", e?.cause?.message); process.exitCode = 1; })
  .finally(async () => { await getPool().end().catch(() => {}); process.exit(process.exitCode || 0); });
