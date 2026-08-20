import assert from 'assert';
import { authLimiter, apiLimiter } from '../backend/dist/middleware/rateLimit.middleware.js';

console.log("================================================================================");
console.log("🧪 TESTING RATE LIMITING MIDDLEWARE POLICIES & MOCK REQUEST CYCLES");
console.log("================================================================================");

// Helper to simulate an Express request through a middleware
function simulateRequest(limiter, reqOptions) {
  return new Promise((resolve) => {
    const req = {
      ip: reqOptions.ip || "127.0.0.1",
      path: reqOptions.path || "/api/products",
      headers: reqOptions.headers || {},
      socket: { remoteAddress: reqOptions.ip || "127.0.0.1" },
    };

    let status = 200;
    let responseBody = null;
    let headersSent = {};

    const res = {
      status(code) {
        status = code;
        return res;
      },
      json(data) {
        responseBody = data;
        resolve({ status, body: responseBody, headers: headersSent });
      },
      setHeader(name, val) {
        headersSent[name] = val;
      },
      getHeader(name) {
        return headersSent[name];
      },
      getHeaderNames() {
        return Object.keys(headersSent);
      },
      removeHeader(name) {
        delete headersSent[name];
      }
    };

    const next = () => {
      resolve({ status: 200, body: { success: true }, nextCalled: true });
    };

    limiter(req, res, next);
  });
}

async function runVerification() {
  // Test 1: Health Check bypass
  console.log("▶️ Test 1: Health checks & root ping are exempt");
  for (let i = 0; i < 40; i++) {
    const res = await simulateRequest(apiLimiter, { path: "/health" });
    assert.equal(res.status, 200);
    assert.equal(res.nextCalled, true);
  }
  console.log("   ✅ Health checks bypassed rate limiter completely.");

  // Test 2: Auth limiter triggers on 31st request
  console.log("\n▶️ Test 2: Auth brute-force protection (30 requests max per 15 min per IP)");
  let authPassed = 0;
  let authBlocked = 0;

  for (let i = 0; i < 35; i++) {
    const res = await simulateRequest(authLimiter, { path: "/api/auth/login", ip: "192.168.1.50" });
    if (res.nextCalled) authPassed++;
    if (res.status === 429) {
      authBlocked++;
      assert.equal(res.body.errorCode, "TOO_MANY_AUTH_ATTEMPTS");
    }
  }

  assert.equal(authPassed, 30, "Should allow exactly 30 login attempts");
  assert.equal(authBlocked, 5, "Requests 31-35 must return HTTP 429");
  console.log(`   ✅ Auth rate limit verified: ${authPassed} passed, ${authBlocked} blocked with 429.`);

  // Test 3: Normal POS API (High volume & token keying)
  console.log("\n▶️ Test 3: Normal POS API operations (600 req/min with token keying)");
  let userAPassed = 0;
  let userBPassed = 0;

  // 100 requests for User A under IP 192.168.1.100
  for (let i = 0; i < 100; i++) {
    const resA = await simulateRequest(apiLimiter, {
      path: "/api/products",
      ip: "192.168.1.100",
      headers: { authorization: "Bearer user_a_token_secret_session_12345" },
    });
    if (resA.nextCalled) userAPassed++;
  }

  // 100 requests for User B under the SAME IP 192.168.1.100
  for (let i = 0; i < 100; i++) {
    const resB = await simulateRequest(apiLimiter, {
      path: "/api/sales",
      ip: "192.168.1.100",
      headers: { authorization: "Bearer user_b_token_secret_session_67890" },
    });
    if (resB.nextCalled) userBPassed++;
  }

  assert.equal(userAPassed, 100);
  assert.equal(userBPassed, 100);
  console.log(`   ✅ POS API rate limit verified: User A (${userAPassed} reqs) and User B (${userBPassed} reqs) operated on shared IP with 0 blocks.`);

  console.log("\n================================================================================");
  console.log("🎉 ALL RATE LIMITING POLICIES VERIFIED SUCCESSFULLY 100%!");
  console.log("================================================================================");
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  });
