import { describe, expect, test } from "bun:test";
import { env } from "../config/env";

describe("Worker JWT dynamic env configuration", () => {
  test("reads runtime process.env.JWT_SECRET dynamically after module load", () => {
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = "dynamic-worker-secret-test-999";
      expect(env.JWT_SECRET).toBe("dynamic-worker-secret-test-999");
    } finally {
      if (prevSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevSecret;
    }
  });

  test("fails closed in production when JWT_SECRET is unset (the dev fallback is public)", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.JWT_SECRET;
      expect(() => env.JWT_SECRET).toThrow(/JWT_SECRET is not configured/);
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevSecret;
    }
  });
});


describe("NODE_ENV resolution", () => {
  test("an unset NODE_ENV resolves to production (no .env, fresh process)", () => {
    const envFile = require("node:path").resolve(import.meta.dir, "../config/env.ts");
    const tmp = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "nodeenv-"));
    const childEnv: Record<string, string> = { PATH: process.env.PATH || "", HOME: process.env.HOME || "" };
    const p = Bun.spawnSync(["bun", "-e", `const { env } = await import(${JSON.stringify(envFile)}); console.log("NODE_ENV=" + env.NODE_ENV);`], { cwd: tmp, env: childEnv });
    expect(p.stdout.toString()).toContain("NODE_ENV=production");
  });
});
