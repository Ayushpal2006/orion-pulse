// Local-only login regression matrix in production mode: existing bcrypt accounts (org admin, store
// user, owner), super-admin via SUPER_ADMIN_PASSWORD, wrong password, protected routes, org/store
// isolation, logout. Creates temporary orgs/stores/users and deletes them afterwards.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const url = process.env.DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }
process.env.NODE_ENV = "production";
process.env.JWT_SECRET = "matrix-" + crypto.randomBytes(24).toString("hex");
process.env.SUPER_ADMIN_PASSWORD = "sa-" + crypto.randomBytes(12).toString("hex");
process.env.ALLOWED_ORIGINS = "http://matrix.local";

const pool = new Pool({ connectionString: url });
const tag = "matrix" + Date.now();
const results: string[] = [];
const ok = (name: string) => { results.push(`PASS ${name}`); };

async function main() {
  const { app } = await import("../app");
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (p: string, body: any, token?: string) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const get = (p: string, token?: string, h: Record<string, string> = {}) => fetch(base + p, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...h } });

  const ids = { orgs: [] as number[], stores: [] as number[], users: [] as number[] };
  try {
    const mkOrg = async (n: string) => (await pool.query("insert into organizations (name, slug, status) values ($1,$2,'active') returning id", [n, n])).rows[0].id as number;
    const mkStore = async (org: number, n: string) => (await pool.query("insert into stores (organization_id, name, code) values ($1,$2,$3) returning id", [org, n, n.toUpperCase()])).rows[0].id as number;
    const pw = "Pw-" + crypto.randomBytes(8).toString("hex");
    const hash = await bcrypt.hash(pw, 10); // same cost as production signup/reset
    const mkUser = async (org: number, store: number, role: string) => {
      const email = `${role.toLowerCase()}.${tag}@test.local`;
      const id = (await pool.query("insert into users (organization_id, store_id, name, email, password_hash, role, is_active, status) values ($1,$2,$3,$4,$5,$6,1,'active') returning id", [org, store, role, email, hash, role])).rows[0].id as number;
      ids.users.push(id);
      return email;
    };
    const orgA = await mkOrg(`${tag}-a`); const orgB = await mkOrg(`${tag}-b`); ids.orgs.push(orgA, orgB);
    const storeA1 = await mkStore(orgA, `${tag}-a1`); const storeA2 = await mkStore(orgA, `${tag}-a2`); const storeB1 = await mkStore(orgB, `${tag}-b1`);
    ids.stores.push(storeA1, storeA2, storeB1);
    const adminA = await mkUser(orgA, storeA1, "admin");
    const cashierA2 = await mkUser(orgA, storeA2, "Cashier");
    const ownerB = await mkUser(orgB, storeB1, "owner");

    const login = async (email: string, password: string) => { const r = await post("/api/auth/login", { email, password }); return { status: r.status, body: await r.json() as any }; };

    const a = await login(adminA, pw); assert.equal(a.status, 200); assert.equal(a.body.data.user.organization_id, orgA); ok("existing org admin login (bcrypt $2b$ hash)");
    const c = await login(cashierA2, pw); assert.equal(c.status, 200); assert.equal(c.body.data.user.store_id, storeA2); ok("existing store user login keeps its store");
    const o = await login(ownerB.toUpperCase() + "  ", pw); assert.equal(o.status, 200); ok("owner login, email case/whitespace-insensitive");
    assert.equal((await login(adminA, pw + "x")).status, 401); ok("wrong password rejected 401");
    assert.equal((await login("nobody." + tag + "@test.local", pw)).status, 401); ok("unknown email rejected 401");
    // Backdoor emails: point admin@apkabill.com at a random hash for this check (restored below).
    const bd = (await pool.query("select id, password_hash from users where email='admin@apkabill.com'")).rows[0];
    if (bd) {
      await pool.query("update users set password_hash=$2 where id=$1", [bd.id, await bcrypt.hash(crypto.randomBytes(9).toString("hex"), 4)]);
      try {
        for (const p of ["admin123", "admin@123", "Admin@123"]) assert.notEqual((await login("admin@apkabill.com", p)).status, 200, `demo password ${p}`);
      } finally { await pool.query("update users set password_hash=$2 where id=$1", [bd.id, bd.password_hash]); }
      ok("legacy demo admin passwords do not work in production");
    }

    const sa = await login("superadmin@orion.com", process.env.SUPER_ADMIN_PASSWORD!); assert.equal(sa.status, 200); assert.equal(sa.body.data.user.role, "super_admin"); ok("super-admin login with SUPER_ADMIN_PASSWORD");
    assert.equal((await login("superadmin@orion.com", "SuperAdmin@123")).status, 401); ok("super-admin demo password rejected");
    assert.equal((await get("/api/super-admin/organizations", sa.body.data.token)).status, 200); ok("super-admin reaches /api/super-admin");
    assert.notEqual((await get("/api/super-admin/organizations", a.body.data.token)).status, 200); ok("org admin blocked from /api/super-admin");

    assert.equal((await get("/api/auth/me")).status, 401); ok("protected route without token 401");
    assert.equal((await get("/api/auth/me", "garbage.token.x")).status, 401); ok("protected route with forged token 401");
    const me = await get("/api/auth/me", a.body.data.token); assert.equal(me.status, 200); ok("protected route with token 200");

    const crossOrg = await get("/api/customers", a.body.data.token, { "x-organization-id": String(orgB), "x-store-id": String(storeB1) });
    assert.ok([400, 403].includes(crossOrg.status), `cross-org header got ${crossOrg.status}`); ok(`org isolation: org A token + org B headers -> ${crossOrg.status}`);
    const ownStore = await get("/api/customers", a.body.data.token, { "x-store-id": String(storeA1) });
    assert.equal(ownStore.status, 200); ok("own store request 200");
    const crossStore = await get("/api/customers", a.body.data.token, { "x-store-id": String(storeB1) });
    assert.ok([400, 403].includes(crossStore.status), `cross-store got ${crossStore.status}`); ok(`store isolation: other org's store -> ${crossStore.status}`);

    const lo = await post("/api/auth/logout", {}, a.body.data.token); assert.ok(lo.status < 400); ok(`logout endpoint ${lo.status}`);
    await pool.query("update users set is_active=0, status='disabled' where email=$1", [cashierA2]);
    assert.equal((await login(cashierA2, pw)).status, 403); ok("disabled user cannot log in (403)");
  } finally {
    server.close();
    if (ids.users.length) await pool.query("delete from audit_logs where user_id = any($1) or store_id = any($2)", [ids.users, ids.stores]);
    if (ids.users.length) await pool.query("delete from users where id = any($1)", [ids.users]);
    if (ids.stores.length) await pool.query("delete from customers where store_id = any($1)", [ids.stores]); // auto-created walk-in rows
    if (ids.stores.length) await pool.query("delete from stores where id = any($1)", [ids.stores]);
    if (ids.orgs.length) await pool.query("delete from organizations where id = any($1)", [ids.orgs]);
  }
  console.log(results.join("\n"));
  console.log(`ALL PASSED (${results.length})`);
}
main().catch((e) => { console.log(results.join("\n")); console.error("FAILED:", e.message); process.exitCode = 1; }).finally(async () => { await pool.end(); setTimeout(() => process.exit(), 200); });
