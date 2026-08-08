import { storeStorage } from "../db/context";
import { SyncQueueManager } from "../services/sync.service";
import { syncRepository, settingsRepository } from "../repositories";
import { db } from "../db";
import { organizations, stores, sync_jobs, settings } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

async function runIsolationTests() {
  console.log("==================================================");
  console.log("🧪 STARTING GOOGLE SHEETS MULTI-TENANT ISOLATION TESTS");
  console.log("==================================================\n");

  // Ensure organization_id column exists on sync_jobs
  await db.execute(sql`ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS organization_id integer REFERENCES organizations(id)`);

  // 1. Setup Test Tenants in PostgreSQL
  console.log("1️⃣ Setting up Organization A and Organization B...");
  
  // Org A
  let [orgA] = await db.select().from(organizations).where(eq(organizations.slug, "isolation-org-a")).limit(1);
  if (!orgA) {
    [orgA] = await db.insert(organizations).values({
      name: "Isolation Org A",
      slug: "isolation-org-a",
    }).returning();
  }

  let [storeA1] = await db.select().from(stores).where(and(eq(stores.name, "Store A1"), eq(stores.organization_id, orgA.id))).limit(1);
  if (!storeA1) {
    [storeA1] = await db.insert(stores).values({
      organization_id: orgA.id,
      name: "Store A1",
    }).returning();
  }

  let [storeA2] = await db.select().from(stores).where(and(eq(stores.name, "Store A2"), eq(stores.organization_id, orgA.id))).limit(1);
  if (!storeA2) {
    [storeA2] = await db.insert(stores).values({
      organization_id: orgA.id,
      name: "Store A2",
    }).returning();
  }

  // Org B
  let [orgB] = await db.select().from(organizations).where(eq(organizations.slug, "isolation-org-b")).limit(1);
  if (!orgB) {
    [orgB] = await db.insert(organizations).values({
      name: "Isolation Org B",
      slug: "isolation-org-b",
    }).returning();
  }

  let [storeB1] = await db.select().from(stores).where(and(eq(stores.name, "Store B1"), eq(stores.organization_id, orgB.id))).limit(1);
  if (!storeB1) {
    [storeB1] = await db.insert(stores).values({
      organization_id: orgB.id,
      name: "Store B1",
    }).returning();
  }

  console.log(`✅ Org A (ID ${orgA.id}) -> Store A1 (ID ${storeA1.id}), Store A2 (ID ${storeA2.id})`);
  console.log(`✅ Org B (ID ${orgB.id}) -> Store B1 (ID ${storeB1.id})\n`);

  // 2. Configure Google Sheets Settings per store
  console.log("2️⃣ Setting store-isolated Google Sheet IDs...");
  const sheetA1 = "SHEET_ID_ORG_A_STORE_1";
  const sheetA2 = "SHEET_ID_ORG_A_STORE_2";
  const sheetB1 = "SHEET_ID_ORG_B_STORE_1";

  await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA1.id, userId: 1, role: "admin" }, async () => {
    await settingsRepository.set("google_sheet_id", sheetA1);
    await settingsRepository.set("google_sync_enabled", "1");
  });

  await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA2.id, userId: 1, role: "admin" }, async () => {
    await settingsRepository.set("google_sheet_id", sheetA2);
    await settingsRepository.set("google_sync_enabled", "1");
  });

  await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB1.id, userId: 1, role: "admin" }, async () => {
    await settingsRepository.set("google_sheet_id", sheetB1);
    await settingsRepository.set("google_sync_enabled", "1");
  });

  // Verify settings stored correctly
  const readA1 = await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA1.id, userId: 1, role: "admin" }, () => settingsRepository.get("google_sheet_id"));
  const readA2 = await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA2.id, userId: 1, role: "admin" }, () => settingsRepository.get("google_sheet_id"));
  const readB1 = await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB1.id, userId: 1, role: "admin" }, () => settingsRepository.get("google_sheet_id"));

  if (readA1 !== sheetA1 || readA2 !== sheetA2 || readB1 !== sheetB1) {
    throw new Error(`❌ Setting store isolation failed: A1=${readA1}, A2=${readA2}, B1=${readB1}`);
  }
  console.log("✅ Store-isolated settings verified successfully.\n");

  // 3. Clean up sync_jobs table for test
  await db.execute(sql`DELETE FROM sync_jobs WHERE store_id IN (${storeA1.id}, ${storeA2.id}, ${storeB1.id})`);

  // 4. Enqueue Sync Jobs with Tenant Context
  console.log("3️⃣ Enqueuing jobs under Org A / Store A1...");
  await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA1.id, userId: 1, role: "admin" }, async () => {
    await syncRepository.enqueue("sale", {
      invoiceNumber: "INV-A1-001",
      grandTotal: 50000,
      organization_id: orgA.id,
      store_id: storeA1.id,
    });
  });

  console.log("4️⃣ Enqueuing jobs under Org B / Store B1...");
  await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB1.id, userId: 1, role: "admin" }, async () => {
    await syncRepository.enqueue("sale", {
      invoiceNumber: "INV-B1-001",
      grandTotal: 99000,
      organization_id: orgB.id,
      store_id: storeB1.id,
    });
  });

  // Verify sync_jobs records in DB
  const jobsA1 = await db.select().from(sync_jobs).where(eq(sync_jobs.store_id, storeA1.id));
  const jobsB1 = await db.select().from(sync_jobs).where(eq(sync_jobs.store_id, storeB1.id));

  if (jobsA1.length !== 1 || jobsA1[0].organization_id !== orgA.id) {
    throw new Error(`❌ Org A1 job enqueued with wrong tenant scope: ${JSON.stringify(jobsA1[0])}`);
  }
  if (jobsB1.length !== 1 || jobsB1[0].organization_id !== orgB.id) {
    throw new Error(`❌ Org B1 job enqueued with wrong tenant scope: ${JSON.stringify(jobsB1[0])}`);
  }
  console.log("✅ Enqueued sync jobs verified with explicit organization_id and store_id.\n");

  // 5. Test Non-Negotiable Tenant Mismatch Rejection
  console.log("5️⃣ Testing Non-Negotiable Tenant Mismatch Safeguard...");
  // Manually insert a mismatched job (payload orgA, but job record orgB)
  const [mismatchedJob] = await db.insert(sync_jobs).values({
    organization_id: orgB.id,
    store_id: storeB1.id,
    job_type: "sale",
    payload: JSON.stringify({
      invoiceNumber: "INV-MISMATCH-999",
      organization_id: orgA.id, // Foreign Org A in Org B job!
      store_id: storeB1.id,
    }),
    status: "pending",
  }).returning();

  // Run queue processor until our test job is processed
  const queueManager = SyncQueueManager.getInstance();
  for (let i = 0; i < 10; i++) {
    await queueManager.processQueue();
    const [checkedMismatch] = await db.select().from(sync_jobs).where(eq(sync_jobs.id, mismatchedJob.id));
    if (checkedMismatch.status !== "pending") break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Re-query mismatched job status
  const [checkedMismatch] = await db.select().from(sync_jobs).where(eq(sync_jobs.id, mismatchedJob.id));
  if (checkedMismatch.status !== "failed" || !checkedMismatch.error_message?.includes("TENANT MISMATCH ABORT")) {
    throw new Error(`❌ Tenant Mismatch Safeguard failed! Job status: ${checkedMismatch.status}, Error: ${checkedMismatch.error_message}`);
  }
  console.log(`✅ Tenant Mismatch Safeguard succeeded! Aborted with message: "${checkedMismatch.error_message}"\n`);

  console.log("==================================================");
  console.log("🎉 ALL MULTI-TENANT ISOLATION TESTS PASSED!");
  console.log("==================================================");
}

runIsolationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Isolation test failed:", err);
    process.exit(1);
  });
