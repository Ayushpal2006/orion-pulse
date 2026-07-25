import express from "express";
import http from "http";
import authRoutes from "../routes/auth.routes";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function traceAuthSteps() {
  console.log("====================================================");
  console.log("AUTHENTICATION FLOW TRACE & VERIFICATION");
  console.log("====================================================");

  // 1. Inspect existing admin@orion.com user in DB
  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@orion.com"))
    .limit(1);

  if (!adminUser) {
    console.log("Step 0: User search for admin@orion.com");
    console.log("user found?: NO ❌");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);

  app.use((err: any, req: any, res: any, next: any) => {
    res.status(err.status || 500).json({ success: false, error: err.message });
  });

  const server = http.createServer(app);

  server.listen(0, async () => {
    const address = server.address() as any;
    const baseUrl = `http://localhost:${address.port}`;

    const testPassword = "admin123";

    console.log("\n[1. POST /api/auth/login REQUEST]");
    console.log("email received:", "admin@orion.com");
    console.log("password provided:", "admin123");

    console.log("\n[2. DATABASE QUERY]");
    console.log("user found?: YES ✅ (ID:", adminUser.id, ", Email:", adminUser.email, ")");
    console.log("password_hash present?: YES ✅ (Length:", adminUser.password_hash?.length, ")");

    console.log("\n[3. BCRYPT VERIFICATION]");
    const bcryptResult = await bcrypt.compare(testPassword, adminUser.password_hash || "");
    console.log("bcrypt result:", bcryptResult ? "MATCH (true) ✅" : "MISMATCH (false) ❌");

    if (!bcryptResult) {
      console.log("STOPPING AT FIRST FAILURE: Bcrypt hash comparison failed.");
      server.close();
      process.exit(1);
    }

    console.log("\n[4. HTTP POST /api/auth/login PIPELINE EXECUTION]");
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@orion.com", password: testPassword }),
    });
    const loginJson = await loginRes.json();

    console.log("HTTP Login Status Code:", loginRes.status);
    console.log("JWT created?:", !!loginJson.data?.token ? "YES ✅" : "NO ❌");
    console.log("Token:", loginJson.data?.token ? `${loginJson.data.token.substring(0, 25)}...` : "NULL");

    if (!loginJson.success || !loginJson.data?.token) {
      console.log("STOPPING AT FIRST FAILURE: Login controller failed to return token.");
      server.close();
      process.exit(1);
    }

    console.log("\n[5. GET /api/auth/me MIDDLEWARE & SESSION VERIFICATION]");
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginJson.data.token}`,
      },
    });
    const meJson = await meRes.json();

    console.log("HTTP /me Status Code:", meRes.status);
    console.log("middleware result:", meRes.status === 200 ? "ALLOWED (200 OK) ✅" : "REJECTED ❌");
    console.log("frontend response user:", meJson.data?.user?.email);
    console.log("frontend response organization:", meJson.data?.organization?.name);
    console.log("frontend response store:", meJson.data?.currentStore?.name);

    if (meRes.status !== 200 || meJson.data?.user?.email !== "admin@orion.com") {
      console.log("STOPPING AT FIRST FAILURE: Auth middleware rejected session.");
      server.close();
      process.exit(1);
    }

    console.log("\n====================================================");
    console.log("ALL AUTHENTICATION FLOW STEPS VERIFIED 100% SUCCESS");
    console.log("====================================================");
    console.log("VERIFIED WORKING CREDENTIALS:");
    console.log("Email: admin@orion.com");
    console.log("Password: admin123");
    console.log("====================================================");

    server.close();
    process.exit(0);
  });
}

traceAuthSteps().catch((err) => {
  console.error("Trace auth steps error:", err);
  process.exit(1);
});
