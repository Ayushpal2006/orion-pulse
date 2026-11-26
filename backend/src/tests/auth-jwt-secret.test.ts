import { describe, it, expect, afterEach } from "bun:test";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth.middleware";

const DEV_SECRET = "orion-pos-secret-key-change-in-prod";
const saved = { secret: process.env.JWT_SECRET, nodeEnv: process.env.NODE_ENV };

afterEach(() => {
  process.env.JWT_SECRET = saved.secret;
  process.env.NODE_ENV = saved.nodeEnv;
});

function run(token: string): Promise<{ status: number; nextCalled: boolean }> {
  return new Promise((resolve) => {
    const res: any = {
      status(code: number) {
        return { json: () => resolve({ status: code, nextCalled: false }) };
      },
    };
    authenticate()({ headers: { authorization: `Bearer ${token}` } } as any, res, () =>
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
});
