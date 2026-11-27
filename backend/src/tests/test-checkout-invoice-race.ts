/**
 * Concurrent checkouts in one store must get distinct invoice numbers (LOCAL DB ONLY).
 * Regression for "last invoice + 1" numbering without a lock.
 */
import assert from "assert";
import { env } from "../config/env";
import { db, getPool } from "../db";
import { products } from "../db/schema";
import { storeStorage } from "../db/context";
import { CheckoutService } from "../services/checkout.service";

const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!/^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }

const RUN = `IR${Date.now().toString().slice(-7)}`;
const svc = new CheckoutService();

async function main() {
  const [prod] = await db.insert(products).values({
    organization_id: 1, store_id: 1, name: `${RUN}-P`, sku: `${RUN}-P`, purchase_price: 0, selling_price: 100, stock: 1000, gst: 0, is_active: 1,
  } as any).returning();
  const ctx = { organizationId: 1, currentStoreId: 1, userId: 1, role: "admin" } as any;
  const N = 6;
  const results: any[] = await Promise.all(Array.from({ length: N }, () =>
    storeStorage.run(ctx, () => svc.executeCheckout({ customerPhone: "0000000000", paymentMethod: "Cash", cashierName: "T",
      items: [{ productId: prod.id, quantity: 1, unitPrice: 10, price: 10 }] } as any))));
  const invoices = results.map((r) => r.invoice);
  assert.strictEqual(new Set(invoices).size, N, `duplicate invoice numbers: ${invoices.join(", ")}`);
  console.log(`✓ ${N} concurrent checkouts got distinct invoices`);
  console.log("🎉 CHECKOUT INVOICE RACE TEST PASSED");
}
main().catch((e) => { console.error("❌", e.message); process.exitCode = 1; })
  .finally(async () => { await getPool().end().catch(() => {}); process.exit(process.exitCode || 0); });
