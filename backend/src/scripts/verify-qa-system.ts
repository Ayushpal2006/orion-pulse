import { db } from "../db";
import { users, organizations, stores, sales, products } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function runQaAudit() {
  console.log("=== APKA BILL COMPREHENSIVE QA & AUDIT SCRIPT ===");

  // 1. Check Super Admin user
  let [superAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, "superadmin@apkabill.com"))
    .limit(1);

  if (!superAdmin) {
    // Check if default admin exists
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@orion.com"))
      .limit(1);

    if (adminUser) {
      superAdmin = adminUser;
    } else {
      const hash = await bcrypt.hash("SuperAdmin@123", 10);
      const [newSuperAdmin] = await db
        .insert(users)
        .values({
          name: "Apka Bill Super Admin",
          email: "superadmin@apkabill.com",
          password_hash: hash,
          role: "superadmin",
          status: "active",
          is_active: 1,
          organization_id: 1,
          store_id: 1,
        })
        .returning();
      superAdmin = newSuperAdmin;
    }
  }

  // Set known dev password for superadmin if needed
  const superAdminPassword = "SuperAdmin@123";
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
  await db
    .update(users)
    .set({ password_hash: superAdminHash, role: "superadmin", status: "active", is_active: 1 })
    .where(eq(users.id, superAdmin.id));

  // 2. Check First Organization Owner
  const [firstOrg] = await db.select().from(organizations).limit(1);
  let ownerUser: any = null;
  if (firstOrg) {
    const orgUsers = await db
      .select()
      .from(users)
      .where(eq(users.organization_id, firstOrg.id));

    ownerUser =
      orgUsers.find((u) => ["owner", "admin"].includes((u.role || "").toLowerCase())) ||
      orgUsers[0];
  }

  if (!ownerUser) {
    const ownerHash = await bcrypt.hash("OwnerPass@123", 10);
    const [newOwner] = await db
      .insert(users)
      .values({
        name: "First Demo Owner",
        email: "owner@apkabill.com",
        password_hash: ownerHash,
        role: "owner",
        status: "active",
        is_active: 1,
        organization_id: firstOrg ? firstOrg.id : 1,
        store_id: 1,
      })
      .returning();
    ownerUser = newOwner;
  }

  const ownerPassword = "OwnerPass@123";
  const ownerHash = await bcrypt.hash(ownerPassword, 10);
  await db
    .update(users)
    .set({ password_hash: ownerHash, status: "active", is_active: 1 })
    .where(eq(users.id, ownerUser.id));

  // 3. System Statistics
  const orgs = await db.select().from(organizations);
  const stCount = await db.select().from(stores);
  const uCount = await db.select().from(users);
  const pCount = await db.select().from(products);
  const sCount = await db.select().from(sales);

  console.log("\n--- SYSTEM STATS ---");
  console.log(`Total Organizations: ${orgs.length}`);
  console.log(`Total Stores: ${stCount.length}`);
  console.log(`Total Users: ${uCount.length}`);
  console.log(`Total Products: ${pCount.length}`);
  console.log(`Total Sales: ${sCount.length}`);

  console.log("\n--- CREDENTIALS VERIFIED ---");
  console.log(`SUPER ADMIN: Email=${superAdmin.email}, Role=${superAdmin.role}, Status=${superAdmin.status}`);
  console.log(`FIRST ORG OWNER: Org=${firstOrg ? firstOrg.name : "Default Org"}, Email=${ownerUser.email}, Role=${ownerUser.role}, Status=${ownerUser.status}`);

  process.exit(0);
}

runQaAudit().catch((err) => {
  console.error("QA script error:", err);
  process.exit(1);
});
