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

  test("safely returns stable fallback in production when JWT_SECRET is unset (zero session crash)", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.JWT_SECRET;
      expect(env.JWT_SECRET).toBe("orion-pos-secret-key-change-in-prod");
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevSecret;
    }
  });
});

