// Local-only: super-admin dashboard/stores/audit endpoints return real aggregates, and tenants are refused.
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import superAdminRoutes from "../routes/super-admin.routes";
import { env } from "../config/env";

const url = process.env.DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }
const pool = new Pool({ connectionString: url });

async function main() {
  const app = express();
  app.use(express.json());
  app.use("/api/super-admin", superAdminRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: err.message }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/super-admin`;
  const sa = jwt.sign({ id: "super-admin", role: "super_admin", organization_id: 1, store_id: 1 }, env.JWT_SECRET);
  const tenant = jwt.sign({ id: 1, role: "admin", organization_id: 1, store_id: 1 }, env.JWT_SECRET);
  const get = async (p: string, t: string) => { const r = await fetch(base + p, { headers: { Authorization: `Bearer ${t}` } }); return { status: r.status, body: await r.json() }; };
  try {
    for (const p of ["/dashboard", "/stores", "/users", "/organizations", "/audit-logs"]) {
      assert.equal((await get(p, tenant)).status, 403, `tenant admin must be refused ${p}`);
    }
    const d = await get("/dashboard", sa);
    assert.equal(d.status, 200, JSON.stringify(d.body));
    const db1 = (await pool.query(`select (select count(*) from organizations)::int o, (select count(*) from stores)::int s, (select count(*) from users)::int u,
      (select coalesce(sum(grand_total),0)::bigint from sales where status is distinct from 'VOID') t`)).rows[0];
    assert.equal(d.body.data.totalOrganizations, db1.o);
    assert.equal(d.body.data.totalStores, db1.s);
    assert.equal(d.body.data.totalUsers, db1.u);
    assert.equal(d.body.data.totalSales, Number(db1.t));
    assert.equal(d.body.data.activeUsers + d.body.data.inactiveUsers, db1.u);
    assert.ok(Array.isArray(d.body.data.recentActivity));

    const st = await get("/stores", sa);
    assert.equal(st.status, 200);
    const s1 = st.body.data.find((x: any) => x.id === 1);
    const exp = (await pool.query(`select count(*)::int c from products where store_id=1`)).rows[0].c;
    assert.equal(s1.totalProducts, exp);

    const al = await get("/audit-logs?action=login&limit=5", sa);
    assert.equal(al.status, 200);
    assert.ok(al.body.data.length <= 5);
    assert.ok(al.body.data.every((l: any) => l.action.includes("LOGIN")));
    console.log("ALL PASSED: dashboard aggregates match DB, store counts, audit filters, tenant refused");
  } finally {
    server.close();
    await pool.end();
  }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; }).then(() => process.exit(process.exitCode || 0));
