import { db } from "../db";
import { organizations, stores, users, audit_logs } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  console.log("=================================================");
  console.log("🚀 VERIFYING SUPER ADMIN CONTROL CENTER & DATABASE");
  console.log("=================================================");

  // 1. Verify Database Connection
  const [orgCount] = await db.select().from(organizations);
  console.log(`✓ Initial Organization Count: ${orgCount ? "Connected" : "Empty"}`);

  // 2. Test Super Admin Organization Creation (Atomic DB Transaction)
  const timestamp = Date.now().toString().slice(-4);
  const testBusiness = `Test Retail Store ${timestamp}`;
  const testEmail = `testowner_${timestamp}@apkabill.com`;
  const passwordHash = await bcrypt.hash("TestPass123", 10);

  const testOrg = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: testBusiness,
        slug: `test-store-${timestamp}`,
        phone: "+91 99988 77766",
        email: testEmail,
        status: "trial",
        billing_plan: "Pro",
        subscription_status: "active",
      })
      .returning();

    const [store] = await tx
      .insert(stores)
      .values({
        organization_id: org.id,
        name: `${testBusiness} Main Branch`,
        code: `STR-${timestamp}`,
        is_default: 1,
        status: "active",
      })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        organization_id: org.id,
        store_id: store.id,
        name: "Test Owner",
        email: testEmail,
        phone: "+91 99988 77766",
        password_hash: passwordHash,
        role: "owner",
        status: "active",
        is_active: 1,
      })
      .returning();

    return { org, store, user };
  });

  console.log(`✓ Created Organization ID #${testOrg.org.id}: "${testOrg.org.name}"`);
  console.log(`✓ Created Default Store ID #${testOrg.store.id}: "${testOrg.store.name}" (${testOrg.store.code})`);
  console.log(`✓ Created Owner User ID #${testOrg.user.id}: "${testOrg.user.email}" (Role: ${testOrg.user.role})`);

  // 3. Test Audit Log Insertion
  await db.insert(audit_logs).values({
    organization_id: testOrg.org.id,
    store_id: testOrg.store.id,
    user_id: testOrg.user.id,
    action: "SUPER_ADMIN_CREATE_ORG",
    details: `Created Test Organization #${testOrg.org.id} (${testOrg.org.name}) via Super Admin`,
    created_at: new Date(),
  });

  const [latestAudit] = await db.select().from(audit_logs).orderBy(desc(audit_logs.id)).limit(1);
  console.log(`✓ Audit Log Entry Verified: ID #${latestAudit.id} | Action: ${latestAudit.action} | Details: ${latestAudit.details}`);

  // 4. Test Store Creation Under Organization
  const [newBranch] = await db
    .insert(stores)
    .values({
      organization_id: testOrg.org.id,
      name: `${testBusiness} Branch 2`,
      code: `STR-${timestamp}-B2`,
      is_default: 0,
      status: "active",
    })
    .returning();
  console.log(`✓ Created Additional Store Branch ID #${newBranch.id}: "${newBranch.name}" under Org #${testOrg.org.id}`);

  // 5. Test Organization Suspension & Reactivation Status Cycle
  await db.update(organizations).set({ status: "suspended" }).where(eq(organizations.id, testOrg.org.id));
  const [suspendedOrg] = await db.select().from(organizations).where(eq(organizations.id, testOrg.org.id));
  console.log(`✓ Organization Status Suspended: status="${suspendedOrg.status}"`);

  await db.update(organizations).set({ status: "active" }).where(eq(organizations.id, testOrg.org.id));
  const [reactivatedOrg] = await db.select().from(organizations).where(eq(organizations.id, testOrg.org.id));
  console.log(`✓ Organization Status Reactivated: status="${reactivatedOrg.status}"`);

  // Clean up test data safely
  await db.delete(audit_logs).where(eq(audit_logs.organization_id, testOrg.org.id));
  await db.delete(users).where(eq(users.organization_id, testOrg.org.id));
  await db.delete(stores).where(eq(stores.organization_id, testOrg.org.id));
  await db.delete(organizations).where(eq(organizations.id, testOrg.org.id));
  console.log(`✓ Cleaned up test organization #${testOrg.org.id} and linked records cleanly.`);

  console.log("=================================================");
  console.log("✨ SUPER ADMIN BACKEND & DATABASE VERIFICATION COMPLETE!");
  console.log("=================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
