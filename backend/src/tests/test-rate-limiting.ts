import express from 'express';
import http from 'http';
import assert from 'assert';
import { authLimiter, apiLimiter } from '../middleware/rateLimit.middleware';

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

async function runTests() {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 8080;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test server listening on ${baseUrl}`);

  // Test 1: Health check is never rate-limited
  console.log("\n▶️ Test 1: Health checks are excluded from rate limits");
  for (let i = 0; i < 50; i++) {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200, `Health check request #${i + 1} should return 200`);
  }
  console.log("   ✅ Health check passed 50/50 requests with 200 OK");

  // Test 2: Auth limiter triggers after max attempts (30 attempts)
  console.log("\n▶️ Test 2: Auth brute-force protection (30 max per 15 min)");
  let authSuccessCount = 0;
  let authRateLimitedCount = 0;

  for (let i = 0; i < 35; i++) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
    });

    if (res.status === 200) {
      authSuccessCount++;
    } else if (res.status === 429) {
      authRateLimitedCount++;
      const data: any = await res.json();
      assert.equal(data.errorCode, "TOO_MANY_AUTH_ATTEMPTS");
      assert.ok(data.message.includes("15 minutes"));
    }
  }

  assert.equal(authSuccessCount, 30, "Should allow exactly 30 auth requests");
  assert.equal(authRateLimitedCount, 5, "Requests 31-35 must return 429 Too Many Requests");
  console.log(`   ✅ Auth rate limit passed: 30 accepted, ${authRateLimitedCount} rejected with 429`);

  // Test 3: Normal API endpoints support high volume and token-based isolation
  console.log("\n▶️ Test 3: Normal POS API endpoints (User A vs User B token isolation)");
  let userASuccess = 0;
  let userBSuccess = 0;

  // 100 requests for User A
  for (let i = 0; i < 100; i++) {
    const res = await fetch(`${baseUrl}/api/products`, {
      headers: { Authorization: "Bearer user_a_token_secret_session_12345" },
    });
    if (res.status === 200) userASuccess++;
  }

  // 100 requests for User B under the SAME IP address
  for (let i = 0; i < 100; i++) {
    const res = await fetch(`${baseUrl}/api/sales`, {
      headers: { Authorization: "Bearer user_b_token_secret_session_67890" },
    });
    if (res.status === 200) userBSuccess++;
  }

  assert.equal(userASuccess, 100, "User A should complete all 100 POS API requests");
  assert.equal(userBSuccess, 100, "User B should complete all 100 POS API requests without interference");
  console.log(`   ✅ POS API rate limiting passed: User A (${userASuccess} reqs) and User B (${userBSuccess} reqs) operated simultaneously on same IP without 429`);

  server.close();
  console.log("\n================================================================================");
  console.log("🎉 ALL RATE LIMITING VERIFICATIONS PASSED 100%!");
  console.log("================================================================================");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ TEST FAILED:", err);
    if (server.listening) server.close();
    process.exit(1);
  });
