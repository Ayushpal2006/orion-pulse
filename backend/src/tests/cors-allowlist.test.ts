import { describe, it, expect } from "bun:test";
import { isOriginAllowed } from "../utils/cors";

const PROD_LIST = "https://apkabill.ayushpalworkplace2006.workers.dev,https://localhost,capacitor://localhost";

describe("CORS allowlist", () => {
  it("allows the web app and Capacitor WebView origins in production", () => {
    for (const o of ["https://apkabill.ayushpalworkplace2006.workers.dev", "https://localhost", "capacitor://localhost", "https://apkabill.ayushpalworkplace2006.workers.dev/"]) {
      expect(isOriginAllowed(o, PROD_LIST, "production")).toBe(true);
    }
  });

  it("rejects unknown and look-alike origins in production", () => {
    for (const o of ["https://evil.example", "https://apkabill.ayushpalworkplace2006.workers.dev.evil.example", "http://apkabill.ayushpalworkplace2006.workers.dev", "http://localhost:3000", "null"]) {
      expect(isOriginAllowed(o, PROD_LIST, "production")).toBe(false);
    }
  });

  it("ignores a bare * and an empty list in production", () => {
    expect(isOriginAllowed("https://evil.example", "*", "production")).toBe(false);
    expect(isOriginAllowed("https://evil.example", undefined, "production")).toBe(false);
  });

  it("supports https wildcard subdomains without matching look-alikes", () => {
    const list = "https://*.apkabill.in";
    expect(isOriginAllowed("https://app.apkabill.in", list, "production")).toBe(true);
    expect(isOriginAllowed("https://evilapkabill.in", list, "production")).toBe(false);
    expect(isOriginAllowed("http://app.apkabill.in", list, "production")).toBe(false);
  });

  it("keeps local development open", () => {
    expect(isOriginAllowed("http://localhost:8081", undefined, "development")).toBe(true);
  });
});
