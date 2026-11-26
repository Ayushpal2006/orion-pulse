import { describe, it, expect, afterEach } from "bun:test";
import express from "express";
import { authorizeSuperAdmin } from "../middleware/auth.middleware";
import adminRoutes from "../routes/admin.routes";

const savedEnv = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = savedEnv;
});

function check(user: any): number {
  let status = 200;
  const res: any = { status: (c: number) => ((status = c), { json: () => undefined }) };
  authorizeSuperAdmin()({ user } as any, res, () => undefined);
  return status;
}

describe("platform admin guards", () => {
  it("rejects tenant admins and owners, including ones using a super-admin email", () => {
    expect(check({ role: "admin", email: "a@shop.in" })).toBe(403);
    expect(check({ role: "owner", email: "superadmin@orion.com" })).toBe(403);
    expect(check({ role: "Supervisor", email: "superadmin@apkabill.com" })).toBe(403);
  });

  it("allows real super admin roles", () => {
    expect(check({ role: "super_admin" })).toBe(200);
    expect(check({ role: "superadmin" })).toBe(200);
  });

  it("refuses reset-demo-data in production before any auth or DB work", async () => {
    process.env.NODE_ENV = "production";
    const app = express();
    app.use("/api/admin", adminRoutes);
    const server = app.listen(0);
    const port = (server.address() as any).port;
    const r = await fetch(`http://127.0.0.1:${port}/api/admin/reset-demo-data`, { method: "POST" });
    server.close();
    expect(r.status).toBe(404);
  });
});
