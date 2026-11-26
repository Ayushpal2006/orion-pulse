/**
 * Detects and repairs offline (Expo) sales that were stored 100x too small.
 *
 * Before commit 4f30121, POST /api/sync/upload stored the RUPEE amounts sent by the mobile
 * app as if they were PAISE. Older mobile builds sent paise and were stored correctly, so the
 * magnitude alone proves nothing. Each line's stored unit price is compared with the product's
 * own price (products.selling_price, paise):
 *   ratio ~ 1/100 on every line -> AFFECTED  (repairable)
 *   ratio ~ 1     on every line -> OK
 *   anything else               -> REVIEW    (never touched automatically)
 * Sales with line discounts (legacy payloads put a PERCENT there), returns, or no matched
 * products are always REVIEW.
 *
 * Usage (from backend/):
 *   bun run src/scripts/repair-offline-sale-amounts.ts                      # dry run, prints report
 *   bun run src/scripts/repair-offline-sale-amounts.ts --apply              # backup JSON + repair
 *   bun run src/scripts/repair-offline-sale-amounts.ts --rollback <file>    # undo a repair
 * DATABASE_URL selects the database. Non-local databases also need --allow-remote.
 */
import fs from "node:fs";
import path from "node:path";
import { Pool, PoolClient } from "pg";

type Classification = "AFFECTED" | "OK" | "REVIEW";
export interface SaleVerdict {
  id: number;
  invoice_number: string;
  organization_id: number | null;
  store_id: number;
  grand_total: number;
  classification: Classification;
  reason: string;
}

const SALE_MONEY = ["subtotal", "discount", "gst", "grand_total", "paid_amount", "balance"] as const;
const ITEM_MONEY = ["selling_price", "line_total"] as const;

/** Pure classifier so it can be unit-tested without a database. */
export function classifySale(
  items: { selling_price: number; product_price: number | null; discount: number }[],
  hasReturns: boolean,
): { classification: Classification; reason: string } {
  if (hasReturns) return { classification: "REVIEW", reason: "has returns" };
  if (items.length === 0) return { classification: "REVIEW", reason: "no items" };
  if (items.some((i) => Number(i.discount) !== 0)) return { classification: "REVIEW", reason: "line discount present" };
  const ratios = items.map((i) => (i.product_price && i.product_price > 0 ? Number(i.selling_price) / Number(i.product_price) : NaN));
  if (ratios.some((r) => !Number.isFinite(r))) return { classification: "REVIEW", reason: "product price unknown" };
  if (ratios.every((r) => r >= 0.005 && r <= 0.02)) return { classification: "AFFECTED", reason: "line prices ~1/100 of product price" };
  if (ratios.every((r) => r >= 0.5 && r <= 2)) return { classification: "OK", reason: "line prices match product price" };
  return { classification: "REVIEW", reason: "mixed or unexpected price ratios" };
}

async function classifyAll(client: Pool | PoolClient, lock = false): Promise<SaleVerdict[]> {
  const sales = (
    await client.query(
      `select id, invoice_number, organization_id, store_id, grand_total from sales
        where invoice_number like 'INV-OFFLINE-%' order by id ${lock ? "for update" : ""}`,
    )
  ).rows;
  if (sales.length === 0) return [];
  const ids = sales.map((s) => s.id);
  const items = (
    await client.query(
      `select si.sale_id, si.selling_price, si.discount, p.selling_price as product_price
         from sale_items si left join products p on p.id = si.product_id
        where si.sale_id = any($1)`,
      [ids],
    )
  ).rows;
  const returned = new Set(
    (await client.query(`select distinct original_sale_id from returns where original_sale_id = any($1)`, [ids])).rows.map(
      (r) => r.original_sale_id,
    ),
  );
  const bySale = new Map<number, any[]>();
  for (const it of items) bySale.set(it.sale_id, [...(bySale.get(it.sale_id) || []), it]);
  return sales.map((s) => ({
    ...s,
    grand_total: Number(s.grand_total),
    ...classifySale(bySale.get(s.id) || [], returned.has(s.id)),
  }));
}

function assertDbAllowed(url: string, allowRemote: boolean) {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (!local && !allowRemote) {
    console.error("Refusing a non-local DATABASE_URL without --allow-remote.");
    process.exit(2);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const rollbackIdx = args.indexOf("--rollback");
  const url = process.env.DATABASE_URL || "";
  if (!url) throw new Error("DATABASE_URL is required");
  assertDbAllowed(url, args.includes("--allow-remote"));
  const pool = new Pool({ connectionString: url, max: 2 });

  try {
    if (rollbackIdx >= 0) {
      const file = args[rollbackIdx + 1];
      const backup = JSON.parse(fs.readFileSync(file, "utf8"));
      const client = await pool.connect();
      try {
        await client.query("begin");
        let restored = 0;
        for (const s of backup.sales) {
          // Only undo rows still holding exactly the repaired values; later edits are left alone.
          const r = await client.query(
            `update sales set ${SALE_MONEY.map((c, i) => `${c} = $${i + 2}`).join(", ")}
              where id = $1 and ${SALE_MONEY.map((c, i) => `${c} = $${i + 2} * 100`).join(" and ")}`,
            [s.id, ...SALE_MONEY.map((c) => s[c])],
          );
          restored += r.rowCount || 0;
        }
        for (const it of backup.items) {
          await client.query(
            `update sale_items set selling_price = $2, line_total = $3
              where id = $1 and selling_price = $2 * 100 and line_total = $3 * 100`,
            [it.id, it.selling_price, it.line_total],
          );
        }
        await client.query("commit");
        console.log(`Rolled back ${restored} sale(s) from ${file}`);
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
      return;
    }

    const verdicts = await classifyAll(pool);
    const count = (c: Classification) => verdicts.filter((v) => v.classification === c).length;
    console.log(`Offline sales: ${verdicts.length} | AFFECTED ${count("AFFECTED")} | OK ${count("OK")} | REVIEW ${count("REVIEW")}`);
    for (const v of verdicts.filter((x) => x.classification !== "OK")) {
      const after = v.classification === "AFFECTED" ? ` -> ${(v.grand_total * 100) / 100} rupees` : "";
      console.log(`${v.classification.padEnd(8)} sale ${v.id} ${v.invoice_number} org ${v.organization_id} store ${v.store_id} total ${v.grand_total / 100} rupees${after} (${v.reason})`);
    }
    if (!apply) {
      console.log("Dry run only. Re-run with --apply to repair the AFFECTED sales.");
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      // Re-classify under row locks so concurrent edits or a second run cannot double-scale.
      const affected = (await classifyAll(client, true)).filter((v) => v.classification === "AFFECTED").map((v) => v.id);
      if (affected.length === 0) {
        await client.query("rollback");
        console.log("Nothing to repair.");
        return;
      }
      const salesBefore = (await client.query(`select id, ${SALE_MONEY.join(", ")} from sales where id = any($1)`, [affected])).rows;
      const itemsBefore = (await client.query(`select id, sale_id, ${ITEM_MONEY.join(", ")} from sale_items where sale_id = any($1)`, [affected])).rows;
      const file = path.resolve(`offline-sale-repair-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      fs.writeFileSync(file, JSON.stringify({ created_at: new Date().toISOString(), sales: salesBefore, items: itemsBefore }, null, 2), { mode: 0o600 });
      console.log(`Backup written: ${file}`);

      await client.query(`update sales set ${SALE_MONEY.map((c) => `${c} = ${c} * 100`).join(", ")} where id = any($1)`, [affected]);
      await client.query(`update sale_items set ${ITEM_MONEY.map((c) => `${c} = ${c} * 100`).join(", ")} where sale_id = any($1)`, [affected]);
      await client.query("commit");
      console.log(`Repaired ${affected.length} sale(s). Undo with: --rollback ${file}`);
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
}
