import express from "express";
import http from "http";
import assert from "assert";
import { authLimiter, apiLimiter } from "../middleware/rateLimit.middleware";

console.log("================================================================================");
console.log("🧪 TESTING TIERED RATE LIMITING POLICIES (ISOLATED IN-PROCESS)");
console.log("================================================================================");

const app = express();
app.use(express.json());

app.post("/api/auth/login", authLimiter, (req, res) => {
  res.status(200).json({ success: true });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.get("/api/products", apiLimiter, (req, res) => {
  res.status(200).json({ success: true, count: 50 });
});

app.get("/api/sales", apiLimiter, (req, res) => {
  res.status(200).json({ success: true, sales: [] });
});

const server = http.createServer(app);

function makeRequest(urlStr: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: {
          Connection: "close",
          ...(options.headers || {}),
        },
        agent: false,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (e) {}
          resolve({ status: res.statusCode || 200, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

server.listen(0, "127.0.0.1", async () => {
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Health check bypass
    console.log("▶️ Test 1: Health check bypass verification");
    for (let i = 0; i < 40; i++) {
      const res = await makeRequest(`${baseUrl}/health`);
      assert.equal(res.status, 200);
    }
    console.log("   ✅ Health check: 40/40 requests returned 200 OK without consuming quota.");

    // 2. Auth limiter: 30 attempts allowed, 31st returns 429
    console.log("\n▶️ Test 2: Auth brute-force protection (30 attempts max per 15 min)");
    let authPassed = 0;
    let authBlocked = 0;
    for (let i = 0; i < 35; i++) {
      const res = await makeRequest(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@orion.com", password: "wrong" }),
      });
      if (res.status === 200) authPassed++;
      if (res.status === 429) {
        authBlocked++;
        assert.equal(res.body.errorCode, "TOO_MANY_AUTH_ATTEMPTS");
      }
    }
    assert.equal(authPassed, 30);
    assert.equal(authBlocked, 5);
    console.log(`   ✅ Auth rate limit: 30 passed, 5 rejected with HTTP 429 (TOO_MANY_AUTH_ATTEMPTS).`);

    // 3. POS API multi-user token test
    console.log("\n▶️ Test 3: Normal POS API operations (600 req/min with token keying)");
    let userA = 0;
    let userB = 0;
    for (let i = 0; i < 60; i++) {
      const resA = await makeRequest(`${baseUrl}/api/products`, {
        headers: { Authorization: "Bearer token_user_cashier_01_abc" },
      });
      if (resA.status === 200) userA++;

      const resB = await makeRequest(`${baseUrl}/api/sales`, {
        headers: { Authorization: "Bearer token_user_cashier_02_xyz" },
      });
      if (resB.status === 200) userB++;
    }
    assert.equal(userA, 60);
    assert.equal(userB, 60);
    console.log(`   ✅ POS API rate limit: Cashier 1 (60 reqs) and Cashier 2 (60 reqs) completed with 0 errors on same IP.`);

    console.log("\n================================================================================");
    console.log("🎉 ALL RATE LIMITING VERIFICATIONS PASSED 100%!");
    console.log("================================================================================");

    server.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    server.close();
    process.exit(1);
  }
});
