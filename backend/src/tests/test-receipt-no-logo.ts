/**
 * Checkout builds the WhatsApp link from a receipt without the logo (LOCAL DB ONLY).
 * The link must be identical to the one built from a full receipt, and no logo may be read.
 */
import assert from "assert";
import { env } from "../config/env";
import { getPool } from "../db";
import { storeStorage } from "../db/context";
import { SalesService } from "../services/sales.service";
import { ShareService } from "../services/share.service";
const salesService = new SalesService();
const shareService = new ShareService();
import { BrandingService } from "../services/branding.service";

const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!/^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }

async function main() {
  const pool = getPool();
  const store = 1;
  const prev = (await pool.query("select value from settings where store_id=$1 and key='logo'", [store])).rows[0]?.value;
  await pool.query("insert into settings (store_id, key, value) values ($1, 'logo', $2) on conflict (store_id, key) do update set value = excluded.value",
    [store, "data:image/png;base64," + "A".repeat(5000)]);
  try {
  const logo = (await BrandingService.getBranding(store, 1)).logo;
  assert.ok(logo, "fixture: store 1 needs a logo for this test to mean anything");
  const noLogo = await BrandingService.getBranding(store, 1, { withLogo: false });
  assert.strictEqual(noLogo.logo, "", "withLogo:false must not return a logo");

  const inv = (await pool.query(
    "select s.invoice_number from sales s join customers c on c.id = s.customer_id where s.store_id=$1 and s.organization_id=1 and length(c.phone) >= 10 and c.phone <> '0000000000' order by s.id desc limit 1", [store])).rows[0]?.invoice_number;
  assert.ok(inv, "fixture: need a sale with a customer phone");
  const ctx = { organizationId: 1, currentStoreId: store, userId: 1, role: "admin" } as any;
  const full = await storeStorage.run(ctx, () => salesService.getReceipt(inv));
  const lite = await storeStorage.run(ctx, () => salesService.getReceipt(inv, { withLogo: false }));
  assert.strictEqual(shareService.generateWhatsAppLink(lite), shareService.generateWhatsAppLink(full));
  console.log(`✓ WhatsApp link identical without logo (${logo.length} bytes skipped)`);
  } finally {
    if (prev === undefined) await pool.query("delete from settings where store_id=$1 and key='logo'", [store]);
    else await pool.query("update settings set value=$2 where store_id=$1 and key='logo'", [store, prev]);
  }
  await pool.end();
  console.log("🎉 RECEIPT NO-LOGO TEST PASSED");
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
