/**
 * Read-only incident review for the 2026-11 exposure (dev-mode production Worker, demo
 * super-admin passwords, admin@orion.com backdoor). Prints evidence; changes nothing.
 *
 *   DATABASE_URL='<neon url>' bun run src/scripts/incident-audit.ts --allow-remote [--since 2026-07-01]
 *
 * Every query runs inside a READ ONLY transaction.
 */
import { Pool } from "pg";

async function main() {
  const args = process.argv.slice(2);
  const url = process.env.DATABASE_URL || "";
  if (!url) throw new Error("DATABASE_URL is required");
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) && !args.includes("--allow-remote")) {
    console.error("Refusing a non-local DATABASE_URL without --allow-remote.");
    process.exit(2);
  }
  const sinceIdx = args.indexOf("--since");
  const since = sinceIdx >= 0 ? args[sinceIdx + 1] : "2026-07-01";
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  const section = async (title: string, text: string, params: any[] = []) => {
    const rows = (await client.query(text, params)).rows;
    console.log(`\n=== ${title} (${rows.length})`);
    for (const r of rows) console.log(JSON.stringify(r));
  };
  try {
    await client.query("begin read only");
    await section(
      "Super-admin actions",
      `select id, created_at, action, organization_id, store_id, left(details, 160) as details
         from audit_logs where action like 'SUPER_ADMIN%' and created_at >= $1 order by id`,
      [since],
    );
    await section(
      "Organizations created or updated",
      `select id, name, status, created_at, updated_at from organizations
        where created_at >= $1 or updated_at >= $1 order by id`,
      [since],
    );
    await section(
      "Users created or updated (no password data)",
      `select id, organization_id, store_id, role, status, is_active, left(email, 3) || '***' as email_hint, created_at, updated_at
         from users where created_at >= $1 or updated_at >= $1 order by id`,
      [since],
    );
    await section(
      "Users with platform-level or backdoor emails",
      `select id, organization_id, role, status, created_at, updated_at from users
        where lower(email) in ('admin@orion.com','admin@apkabill.com','superadmin@orion.com','superadmin@apkabill.com')`,
    );
    await section(
      "Destructive or settings-related audit actions",
      `select id, created_at, action, organization_id, store_id, left(details, 160) as details from audit_logs
        where created_at >= $1 and (action ilike '%DELETE%' or action ilike '%RESET%' or action ilike '%RESTORE%'
          or action ilike '%BACKUP%' or action ilike '%PASSWORD%' or action ilike '%ROLE%') order by id`,
      [since],
    );
    await section(
      "Row counts (compare with the 2026-09-09 dump: customers 563, sales 916, users 4, organizations 4, stores 6)",
      `select (select count(*) from organizations) orgs, (select count(*) from stores) stores, (select count(*) from users) users,
              (select count(*) from customers) customers, (select count(*) from sales) sales, (select count(*) from products) products`,
    );
    await client.query("rollback");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
