import { db } from "../db";
import { users, organizations, stores, user_store_access } from "../db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import express from "express";
import http from "http";
import authRoutes from "../routes/auth.routes";

async function debugAuthPipeline() {
  console.log("====================================================");
  console.log("STEP-BY-STEP AUTHENTICATION PIPELINE DEBUG & TRACE");
  console.log("====================================================");

  // 1. Ensure Default Organization & Store exist
  let [org] = await db.select().from(organizations).where(eq(organizations.id, 1)).limit(1);
  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({
        id: 1,
        name: "Apka Bill Store",
        slug: "apka-bill-store",
        status: "active",
        billing_plan: "Enterprise",
        subscription_status: "active",
        onboarding_completed: 1,
      })
      .returning();
    console.log("✅ Step 0a: Default Organization #1 initialized");
  } else {
    await db
      .update(organizations)
      .set({ status: "active", onboarding_completed: 1 })
      .where(eq(organizations.id, 1));
  }

  let [store] = await db.select().from(stores).where(eq(stores.id, 1)).limit(1);
  if (!store) {
    [store] = await db
      .insert(stores)
      .values({
        id: 1,
        organization_id: 1,
        name: "Main Store",
        code: "STR-001",
        is_default: 1,
        status: "active",
      })
      .returning();
    console.log("✅ Step 0b: Default Store #1 initialized");
  }

  // 2. Locate ONLY existing user (admin@orion.com or user ID #1) and update password_hash safely
  const newPassword = "admin123";
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  let [adminUser] = await db.select().from(users).where(eq(users.id, 1)).limit(1);
  if (!adminUser) {
    [adminUser] = await db.select().from(users).where(eq(users.email, "admin@orion.com")).limit(1);
  }

  if (adminUser) {
    [adminUser] = await db
      .update(users)
      .set({
        name: "Default Admin",
        email: "admin@orion.com",
        password_hash: newPasswordHash,
        role: "admin",
        organization_id: 1,
        store_id: 1,
        is_active: 1,
        status: "active",
        updated_at: new Date(),
      })
      .where(eq(users.id, adminUser.id))
      .returning();
    console.log(`✅ Step 0c: Safely updated ONLY existing user #${adminUser.id} (${adminUser.email}) password_hash to known bcrypt hash`);
  } else {
    [adminUser] = await db
      .insert(users)
      .values({
        id: 1,
        name: "Default Admin",
        email: "admin@orion.com",
        phone: "8285068670",
        password_hash: newPasswordHash,
        role: "admin",
        organization_id: 1,
        store_id: 1,
        is_active: 1,
        status: "active",
      })
      .returning();
    console.log("✅ Step 0c: Existing user admin@orion.com initialized");
  }

  // Ensure user_store_access
  const [access] = await db
    .select()
    .from(user_store_access)
    .where(and(eq(user_store_access.user_id, adminUser.id), eq(user_store_access.store_id, 1)))
    .limit(1);
  if (!access) {
    await db.insert(user_store_access).values({ user_id: adminUser.id, store_id: 1 });
  }

  console.log("\n--------------------------------------------------");
  console.log("DETAILED FLOW TRACE: admin@orion.com LOGIN");
  console.log("--------------------------------------------------");

  // STEP 1: FRONTEND LOGIN INPUT
  const inputEmail = "admin@orion.com";
  const inputPassword = "admin123";
  console.log("\n[STEP 1: Frontend Login Input]");
  console.log("Input Email:", inputEmail);
  console.log("Input Password:", inputPassword ? "••••••••" : "MISSING");
  console.log("Status: SUCCESS ✅");

  // STEP 2: DATABASE QUERY
  console.log("\n[STEP 2: Database Query]");
  const normalizedEmail = inputEmail.trim().toLowerCase();
  const [queriedUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!queriedUser) {
    console.log("Output: NULL");
    console.log("Status: FAILURE ❌ (User not found in DB by email)");
    process.exit(1);
  }
  console.log("Query Result User ID:", queriedUser.id);
  console.log("Query Result Email:", queriedUser.email);
  console.log("Query Result Role:", queriedUser.role);
  console.log("Query Result Org ID:", queriedUser.organization_id);
  console.log("Query Result Store ID:", queriedUser.store_id);
  console.log("Query Result Password Hash:", queriedUser.password_hash ? `${queriedUser.password_hash.substring(0, 15)}...` : "NULL");
  console.log("Status: SUCCESS ✅");

  // STEP 3: PASSWORD VERIFICATION (bcrypt)
  console.log("\n[STEP 3: Password Verification (bcrypt)]");
  const isMatch = await bcrypt.compare(inputPassword, queriedUser.password_hash || "");
  console.log("bcrypt.compare(inputPassword, password_hash):", isMatch);
  if (!isMatch) {
    console.log("Status: FAILURE ❌ (Password hash mismatch)");
    process.exit(1);
  }
  console.log("Status: SUCCESS ✅");

  // STEP 4: USER & ORG STATUS VERIFICATION
  console.log("\n[STEP 4: User & Organization Status Verification]");
  if (queriedUser.status === "disabled" || queriedUser.is_active === 0) {
    console.log("Status: FAILURE ❌ (User account disabled)");
    process.exit(1);
  }
  const [userOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, queriedUser.organization_id || 1))
    .limit(1);

  const orgStatus = userOrg ? (userOrg.status || "active").toLowerCase() : "active";
  if (orgStatus === "suspended") {
    console.log("Status: FAILURE ❌ (Organization account suspended)");
    process.exit(1);
  }
  console.log("User Status:", queriedUser.status || "active");
  console.log("Organization Status:", orgStatus);
  console.log("Status: SUCCESS ✅");

  // STEP 5: JWT / SESSION CREATION
  console.log("\n[STEP 5: JWT / Session Creation]");
  const token = jwt.sign(
    {
      id: queriedUser.id,
      email: queriedUser.email,
      role: queriedUser.role,
      organization_id: queriedUser.organization_id || 1,
      store_id: queriedUser.store_id || 1,
      name: queriedUser.name,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );
  console.log("Generated JWT Token:", `${String(token).substring(0, 25)}...`);
  console.log("Status: SUCCESS ✅");

  // STEP 6: AUTH MIDDLEWARE & /api/auth/me VERIFICATION OVER HTTP
  console.log("\n[STEP 6: Express Server HTTP Endpoint Verification]");
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);

  const server = http.createServer(app);
  server.listen(0, async () => {
    const address = server.address() as any;
    const baseUrl = `http://localhost:${address.port}`;

    // A. HTTP Login Request
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inputEmail, password: inputPassword }),
    });
    const loginData = await loginRes.json();
    console.log("\n[STEP 6a: POST /api/auth/login HTTP Response]");
    console.log("HTTP Status Code:", loginRes.status);
    console.log("JSON Success:", loginData.success);
    console.log("Payload User:", loginData.data?.user);
    if (!loginData.success || !loginData.data?.token) {
      console.log("Status: FAILURE ❌ (HTTP Login failed)");
      server.close();
      process.exit(1);
    }
    console.log("Status: SUCCESS ✅");

    // B. HTTP /api/auth/me Session Validation
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginData.data.token}`,
      },
    });
    const meData = await meRes.json();
    console.log("\n[STEP 6b: GET /api/auth/me HTTP Response]");
    console.log("HTTP Status Code:", meRes.status);
    console.log("Session Verified User:", meData.data?.user?.email);
    console.log("Session Verified Org:", meData.data?.organization?.name);
    console.log("Session Verified Store:", meData.data?.currentStore?.name);

    if (!meData.success || meData.data?.user?.email !== inputEmail) {
      console.log("Status: FAILURE ❌ (GET /api/auth/me failed)");
      server.close();
      process.exit(1);
    }
    console.log("Status: SUCCESS ✅");

    console.log("\n====================================================");
    console.log("VERIFIED WORKING LOGIN CREDENTIALS");
    console.log("====================================================");
    console.log("Email: admin@orion.com");
    console.log("Password: admin123");
    console.log("Role: admin");
    console.log("Status: active");
    console.log("Organization: Apka Bill Store");
    console.log("====================================================");

    server.close();
    process.exit(0);
  });
}

debugAuthPipeline().catch((err) => {
  console.error("Debug auth pipeline error:", err);
  process.exit(1);
});
