// Local-only: legacy demo passwords must not work in production; login events are audited.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { AuthController } from "../controllers/auth.controller";

const url = process.env.DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error("REFUSING non-local DB"); process.exit(1); }
const pool = new Pool({ connectionString: url });
const EMAIL = "admin@apkabill.com";

async function login(password: string): Promise<number> {
  return new Promise((resolve) => {
    const res: any = { status: (c: number) => ({ json: () => resolve(c) }) };
    new AuthController().login({ body: { email: EMAIL, password }, ip: "127.0.0.1" } as any, res, (e: any) => { console.error(e); resolve(500); });
  });
}

async function main() {
  const real = crypto.randomBytes(12).toString("hex");
  const existing = (await pool.query("select id, password_hash from users where email=$1", [EMAIL])).rows[0];
  let userId: number;
  if (existing) {
    userId = existing.id;
    await pool.query("update users set password_hash=$2 where id=$1", [userId, await bcrypt.hash(real, 4)]);
  } else {
    userId = (await pool.query(
      "insert into users (organization_id, store_id, name, email, password_hash, role, is_active, status) values (1,1,'Backdoor Test',$1,$2,'admin',1,'active') returning id",
      [EMAIL, await bcrypt.hash(real, 4)])).rows[0].id;
  }
  const startId = Number((await pool.query("select coalesce(max(id),0) as m from audit_logs")).rows[0].m);
  const savedEnv = process.env.NODE_ENV, savedSecret = process.env.JWT_SECRET;
  try {
    process.env.JWT_SECRET = "test-secret-" + crypto.randomBytes(16).toString("hex");
    process.env.NODE_ENV = "production";
    for (const p of ["admin123", "admin@123", "Admin@123"]) assert.equal(await login(p), 401, `demo password ${p} must fail in production`);
    assert.equal(await login(real), 200, "real password works in production");
    process.env.NODE_ENV = "development";
    assert.equal(await login("admin123"), 200, "demo password still works locally");
    const events = (await pool.query("select action from audit_logs where user_id=$1 and id > $2", [userId, startId])).rows.map((r) => r.action);
    assert.ok(events.includes("LOGIN_FAILED") && events.includes("LOGIN_SUCCESS"), `audit events: ${events}`);
    console.log("ALL PASSED: no production backdoor, real password works, logins audited");
  } finally {
    process.env.NODE_ENV = savedEnv; process.env.JWT_SECRET = savedSecret;
    if (existing) await pool.query("update users set password_hash=$2 where id=$1", [userId, existing.password_hash]);
    else { await pool.query("delete from audit_logs where user_id=$1", [userId]); await pool.query("delete from users where id=$1", [userId]); }
  }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; }).finally(() => pool.end());
