/**
 * Smallest real-path amount test (LOCAL DB ONLY): calls the REAL CheckoutService.executeCheckout.
 * Contract: request RUPEES -> DB PAISE -> response RUPEES.
 */
import assert from "assert";
import { env } from "../config/env";
import { db, getPool } from "../db";
import { products } from "../db/schema";
import { storeStorage } from "../db/context";
import { CheckoutService } from "../services/checkout.service";

const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!/^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }

const RUN = `CA${Date.now().toString().slice(-7)}`;
const svc = new CheckoutService();
const mk = async (n: string, gst: number) => (await db.insert(products).values({
  organization_id: 1, store_id: 1, name: `${RUN}-${n}`, sku: `${RUN}-${n}`, purchase_price: 0,
  selling_price: 100, stock: 1000, gst, is_active: 1,
} as any).returning())[0];

async function main() {
  const ctx = { organizationId: 1, currentStoreId: 1, userId: 1, role: "admin" } as any;
  await storeStorage.run(ctx, async () => {
    for (const [r, p] of [[1,100],[10,1000],[100,10000],[500,50000],[1200,120000],[1234,123400],[9999,999900],[10000,1000000],[100000,10000000]] as const) {
      const prod = await mk(`M${r}`, 0);
      const res: any = await svc.executeCheckout({ customerPhone: "0000000000", paymentMethod: "Cash", cashierName: "T",
        items: [{ productId: prod.id, quantity: 1, unitPrice: r, price: r }] } as any);
      const row = (await getPool().query("select subtotal, grand_total from sales where id=$1", [res.saleId])).rows[0];
      assert.strictEqual(Number(row.grand_total), p, `DB paise for ₹${r}`);
      assert.strictEqual(res.grandTotal, r, `response rupees for ₹${r}`);
      console.log(`PASS ₹${r} -> ${row.grand_total} paise -> ₹${res.grandTotal}`);
    }
    const g = await mk("GST", 18);
    const res: any = await svc.executeCheckout({ customerPhone: "0000000000", paymentMethod: "Cash", cashierName: "T", discount: 200,
      items: [{ productId: g.id, quantity: 1, unitPrice: 1200 }] } as any);
    const row = (await getPool().query("select subtotal,discount,gst,grand_total from sales where id=$1", [res.saleId])).rows[0];
    assert.deepStrictEqual([res.subtotal, res.discount, res.gst, res.grandTotal], [1200, 200, 216, 1216]);
    assert.strictEqual(Number(row.grand_total), 121600);
    console.log("PASS ₹1200 - ₹200 + 18% GST => ₹1216, DB 121600 paise");
  });
  console.log("ALL PASSED");
}
main().catch(e => { console.error("FAILED:", e.message.slice(0,60), "| CAUSE:", e?.cause?.message, e?.cause?.detail); process.exitCode = 1; }).finally(async () => { await getPool().end().catch(()=>{}); process.exit(process.exitCode || 0); });
