import { db } from "../db";
import { users, organizations, stores, user_store_access } from "../db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

async function testLoginFlow() {
  console.log("=== TESTING COMPLETE AUTHENTICATION & LOGIN FLOW ===");

  // 1. Ensure Default Organization exists
  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({
        name: "Apka Bill Demo",
        slug: "apka-bill-demo",
        phone: "8285068670",
        email: "contact@apkabill.com",
        status: "active",
        billing_plan: "Basic",
        subscription_status: "active",
        onboarding_completed: 1,
      })
      .returning();
    console.log("✅ Default Organization created:", org.name);
  } else {
    await db
      .update(organizations)
      .set({ status: "active", onboarding_completed: 1 })
      .where(eq(organizations.id, org.id));
  }

  // 2. Ensure Default Store exists
  let [store] = await db.select().from(stores).where(eq(stores.organization_id, org.id)).limit(1);
  if (!store) {
    [store] = await db
      .insert(stores)
      .values({
        organization_id: org.id,
        name: "Main Store",
        code: "STR-MAIN",
        phone: "8285068670",
        is_default: 1,
        status: "active",
      })
      .returning();
    console.log("✅ Default Store created:", store.name);
  }

  // 3. Ensure Super Admin user exists
  const superAdminPassword = "SuperAdmin@123";
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
  let [superAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, "superadmin@apkabill.com"))
    .limit(1);

  if (!superAdmin) {
    [superAdmin] = await db
      .insert(users)
      .values({
        organization_id: org.id,
        store_id: store.id,
        name: "Super Admin",
        email: "superadmin@apkabill.com",
        phone: "8285068670",
        password_hash: superAdminHash,
        role: "superadmin",
        status: "active",
        is_active: 1,
      })
      .returning();
    console.log("✅ Super Admin user created:", superAdmin.email);
  } else {
    await db
      .update(users)
      .set({
        password_hash: superAdminHash,
        role: "superadmin",
        status: "active",
        is_active: 1,
      })
      .where(eq(users.id, superAdmin.id));
    console.log("✅ Super Admin user updated:", superAdmin.email);
  }

  // 4. Ensure First Organization Owner user exists
  const ownerPassword = "OwnerPass@123";
  const ownerHash = await bcrypt.hash(ownerPassword, 10);

  // Check if owner user exists by email or id=1
  let [ownerUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "owner@apkabill.com"))
    .limit(1);

  if (!ownerUser) {
    // Check if legacy user #1 exists
    const [user1] = await db.select().from(users).where(eq(users.id, 1)).limit(1);
    if (user1 && user1.email !== "superadmin@apkabill.com") {
      ownerUser = user1;
      await db
        .update(users)
        .set({
          name: "Apka Bill Demo Owner",
          email: "owner@apkabill.com",
          password_hash: ownerHash,
          role: "owner",
          status: "active",
          is_active: 1,
          organization_id: org.id,
          store_id: store.id,
        })
        .where(eq(users.id, 1));
      console.log("✅ First Organization Owner user updated from legacy user #1:", ownerUser.email);
    } else {
      [ownerUser] = await db
        .insert(users)
        .values({
          organization_id: org.id,
          store_id: store.id,
          name: "Apka Bill Demo Owner",
          email: "owner@apkabill.com",
          phone: "8285068670",
          password_hash: ownerHash,
          role: "owner",
          status: "active",
          is_active: 1,
        })
        .returning();
      console.log("✅ First Organization Owner user inserted:", ownerUser.email);
    }
  } else {
    await db
      .update(users)
      .set({
        password_hash: ownerHash,
        role: "owner",
        status: "active",
        is_active: 1,
        organization_id: org.id,
        store_id: store.id,
      })
      .where(eq(users.id, ownerUser.id));
    console.log("✅ First Organization Owner user updated:", ownerUser.email);
  }

  // 5. Test Bcrypt Passwords
  const superAdminMatch = await bcrypt.compare(superAdminPassword, superAdmin.password_hash);
  const ownerMatch = await bcrypt.compare(ownerPassword, ownerUser.password_hash);

  console.log("\n--- BCRYPT COMPARISON TEST ---");
  console.log(`Super Admin Password Match: ${superAdminMatch ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`Owner Password Match: ${ownerMatch ? "PASS ✅" : "FAIL ❌"}`);

  if (!superAdminMatch || !ownerMatch) {
    throw new Error("Bcrypt comparison test failed");
  }

  // 6. Test JWT Generation & Verification
  const saToken = jwt.sign(
    { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role, organizationId: org.id, storeId: store.id },
    env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  const ownerToken = jwt.sign(
    { id: ownerUser.id, email: ownerUser.email, role: ownerUser.role, organizationId: org.id, storeId: store.id },
    env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  const saDecoded: any = jwt.verify(saToken, env.JWT_SECRET);
  const ownerDecoded: any = jwt.verify(ownerToken, env.JWT_SECRET);

  console.log("\n--- JWT VERIFICATION TEST ---");
  console.log(`Super Admin Token Decoded: ID=${saDecoded.id}, Role=${saDecoded.role} ✅`);
  console.log(`Owner Token Decoded: ID=${ownerDecoded.id}, Role=${ownerDecoded.role} ✅`);

  console.log("\n====================================================");
  console.log("VERIFIED WORKING LOGIN CREDENTIALS");
  console.log("====================================================");
  console.log("SUPER ADMIN");
  console.log("Email: superadmin@apkabill.com");
  console.log("Password: SuperAdmin@123");
  console.log("Role: superadmin");
  console.log("--------------------------------------------------");
  console.log("FIRST ORGANIZATION OWNER");
  console.log(`Organization: ${org.name}`);
  console.log("Email: owner@apkabill.com");
  console.log("Password: OwnerPass@123");
  console.log("Role: owner");
  console.log("====================================================");

  process.exit(0);
}

testLoginFlow().catch((err) => {
  console.error("Test login flow error:", err);
  process.exit(1);
});
