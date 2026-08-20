const express = require('express');
const http = require('http');
const assert = require('assert');
const { authLimiter, apiLimiter } = require('../backend/dist/middleware/rateLimit.middleware');

console.log("================================================================================");
console.log("🧪 TESTING TIERED RATE LIMITING (AUTH VS POS API ISOLATION)");
console.log("================================================================================");

const app = express();
app.use(express.json());

// Mount limiters
app.use("/api/auth", authLimiter, (req, res) => {
  res.status(200).json({ success: true, route: "auth" });
});

app.use("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.use("/api", apiLimiter, (req, res) => {
  res.status(200).json({ success: true, route: "api", user: req.headers.authorization || "anonymous" });
});

const server = http.createServer(app);

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running on ${baseUrl}`);

  try {
    // 1. Health check exemption
    console.log("\n▶️ Test 1: Health check exemption");
    for (let i = 0; i < 50; i++) {
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);
    }
    console.log("   ✅ Health check: 50/50 requests returned 200 OK without rate limit");

    // 2. Auth limiter: 30 allowed, 31st rejected with 429
    console.log("\n▶️ Test 2: Auth brute-force protection (30 allowed per 15 min)");
    let authPassed = 0;
    let authLimited = 0;

    for (let i = 0; i < 35; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cashier@store.com', password: 'bad' }),
      });
      if (res.status === 200) authPassed++;
      if (res.status === 429) {
        authLimited++;
        const data = await res.json();
        assert.strictEqual(data.errorCode, 'TOO_MANY_AUTH_ATTEMPTS');
      }
    }
    assert.strictEqual(authPassed, 30);
    assert.strictEqual(authLimited, 5);
    console.log(`   ✅ Auth rate limiter: 30 requests permitted, ${authLimited} requests blocked with 429`);

    // 3. POS API: 100 requests per user under same IP
    console.log("\n▶️ Test 3: Authenticated POS APIs (High volume & token-based isolation)");
    let userA = 0;
    let userB = 0;

    for (let i = 0; i < 100; i++) {
      const resA = await fetch(`${baseUrl}/api/products`, {
        headers: { Authorization: 'Bearer token_cashier_device_1_abcdefghijk' },
      });
      if (resA.status === 200) userA++;

      const resB = await fetch(`${baseUrl}/api/sales`, {
        headers: { Authorization: 'Bearer token_cashier_device_2_lmnopqrstuv' },
      });
      if (resB.status === 200) userB++;
    }

    assert.strictEqual(userA, 100);
    assert.strictEqual(userB, 100);
    console.log(`   ✅ POS API rate limiter: Device 1 (${userA} reqs) and Device 2 (${userB} reqs) operated concurrently with 0 blocks`);

    console.log("\n================================================================================");
    console.log("🎉 ALL RATE LIMITING INTEGRATION TESTS PASSED 100%!");
    console.log("================================================================================");

    server.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    server.close();
    process.exit(1);
  }
});
