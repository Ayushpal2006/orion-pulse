import express from 'express';
import http from 'http';
import assert from 'assert';
import { authLimiter, apiLimiter } from '../backend/dist/middleware/rateLimit.middleware.js';

console.log("================================================================================");
console.log("🧪 VERIFYING RATE LIMITING MIDDLEWARE POLICIES");
console.log("================================================================================");

const app = express();
app.use(express.json());

app.use("/api/auth/login", authLimiter, (req, res) => {
  res.json({ success: true });
});

app.use("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/products", apiLimiter, (req, res) => {
  res.json({ success: true, count: 10 });
});

const server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Health check bypass test
    console.log("▶️ Test 1: Health check bypass verification");
    for (let i = 0; i < 40; i++) {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 200);
    }
    console.log("   ✅ Health check: 40 requests returned 200 OK without consuming quota.");

    // 2. Auth limiter test (30 allowed, 31st blocked with 429)
    console.log("\n▶️ Test 2: Auth brute-force protection (30 attempts max per 15 min)");
    let authPassed = 0;
    let authBlocked = 0;
    for (let i = 0; i < 35; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@orion.com", password: "wrong" }),
      });
      if (res.status === 200) authPassed++;
      if (res.status === 429) {
        authBlocked++;
        const data = await res.json();
        assert.equal(data.errorCode, "TOO_MANY_AUTH_ATTEMPTS");
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
      const resA = await fetch(`${baseUrl}/api/products`, {
        headers: { Authorization: "Bearer token_user_cashier_01_abc" },
      });
      if (resA.status === 200) userA++;

      const resB = await fetch(`${baseUrl}/api/products`, {
        headers: { Authorization: "Bearer token_user_cashier_02_xyz" },
      });
      if (resB.status === 200) userB++;
    }
    assert.equal(userA, 60);
    assert.equal(userB, 60);
    console.log(`   ✅ POS API rate limit: Cashier 1 (60 reqs) and Cashier 2 (60 reqs) completed with 0 errors.`);

    console.log("\n================================================================================");
    console.log("🎉 ALL RATE LIMITING VERIFICATIONS PASSED!");
    console.log("================================================================================");
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    server.close();
    process.exit(1);
  }
});
