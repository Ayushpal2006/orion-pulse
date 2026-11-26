import { describe, it, expect, afterEach } from "bun:test";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth.middleware";
import { verifyHS256JWT } from "../middleware/admin-auth.middleware";

const DEV_SECRET = "orion-pos-secret-key-change-in-prod";
const saved = { secret: process.env.JWT_SECRET, nodeEnv: process.env.NODE_ENV };

afterEach(() => {
  process.env.JWT_SECRET = saved.secret;
  process.env.NODE_ENV = saved.nodeEnv;
});

const REAL = "a-real-production-secret-value-0123456789";

function run(token: string, headers: Record<string, string> = {}): Promise<{ status: number; nextCalled: boolean }> {
  return new Promise((resolve) => {
    const res: any = {
      status(code: number) {
        return { json: () => resolve({ status: code, nextCalled: false }) };
      },
    };
    authenticate()({ headers: { authorization: `Bearer ${token}`, ...headers } } as any, res, () =>
      resolve({ status: 200, nextCalled: true }),
    );
  });
}

describe("JWT secret hardening", () => {
  it("rejects a token signed with the public dev secret when a real secret is configured", async () => {
    process.env.JWT_SECRET = "a-real-production-secret-value-0123456789";
    const forged = jwt.sign({ id: 1, role: "SuperAdmin", organization_id: 1 }, DEV_SECRET);
    const result = await run(forged);
    expect(result.status).toBe(401);
    expect(result.nextCalled).toBe(false);
  });

  it("refuses to use the dev secret in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = DEV_SECRET;
    expect(() => env.JWT_SECRET).toThrow(/JWT_SECRET is not configured/);
    process.env.JWT_SECRET = "";
    expect(() => env.JWT_SECRET).toThrow(/JWT_SECRET is not configured/);
  });

  it("allows the dev secret only outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "";
    expect(env.JWT_SECRET).toBe(DEV_SECRET);
  });

  it("rejects expired, tampered, wrong-algorithm and malformed tokens", async () => {
    process.env.JWT_SECRET = REAL;
    const expired = jwt.sign({ id: 1, role: "owner", organization_id: 1, exp: Math.floor(Date.now() / 1000) - 60 }, REAL);
    const good = jwt.sign({ id: 1, role: "owner", organization_id: 1 }, REAL);
    const [h, , sig] = good.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ id: 1, role: "owner", organization_id: 2 })).toString("base64url");
    const tampered = `${h}.${tamperedPayload}.${sig}`;
    const noneAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${tamperedPayload}.`;
    const hs512 = jwt.sign({ id: 1, role: "owner", organization_id: 1 }, REAL, { algorithm: "HS512" });
    for (const t of [expired, tampered, noneAlg, hs512, "not.a.jwt", "garbage"]) {
      expect((await run(t)).status).toBe(401);
    }
  });

  it("blocks a normal user from switching organization via header", async () => {
    process.env.JWT_SECRET = REAL;
    const token = jwt.sign({ id: 1, role: "owner", organization_id: 1 }, REAL);
    expect((await run(token, { "x-organization-id": "2" })).status).toBe(403);
  });

  it("does not treat roles that merely contain 'super' as super admin", async () => {
    process.env.JWT_SECRET = REAL;
    const token = jwt.sign({ id: 1, role: "Supervisor", organization_id: 1 }, REAL);
    expect((await run(token, { "x-organization-id": "2" })).status).toBe(403);
  });

  it("admin verifier enforces expiry and signature", () => {
    const expired = jwt.sign({ role: "admin", exp: Math.floor(Date.now() / 1000) - 60 }, REAL);
    expect(() => verifyHS256JWT(expired, REAL)).toThrow();
    expect(() => verifyHS256JWT(jwt.sign({ role: "admin" }, DEV_SECRET), REAL)).toThrow();
    expect(verifyHS256JWT(jwt.sign({ role: "admin" }, REAL), REAL).role).toBe("admin");
  });
});
