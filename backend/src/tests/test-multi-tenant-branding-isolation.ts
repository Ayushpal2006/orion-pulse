import { db } from "../db";
import { organizations, stores, settings, sales, sale_items, products, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { PostgresSettingsRepository } from "../repositories/postgres/settings.repository";
import { ReceiptBuilderService } from "../services/receipt-builder.service";
import { storeStorage } from "../db/context";

async function runMultiTenantBrandingVerification() {
  console.log("==================================================");
  console.log("🧪 MULTI-TENANT BRANDING ISOLATION VERIFICATION");
  console.log("==================================================\n");

  const settingsRepo = new PostgresSettingsRepository();

  // 1. Setup 3 distinct Organizations & Stores
  console.log("1️⃣ Provisioning 3 Test Organizations & Stores...");

  const timestamp = Date.now();

  // Org A
  let [orgA] = await db.select().from(organizations).where(eq(organizations.name, "Tenant Test Org A")).limit(1);
  if (!orgA) {
    [orgA] = await db.insert(organizations).values({ name: "Tenant Test Org A", phone: "9990000001", gst_number: "27AAAAA1111A1Z1" }).returning();
  }
  let [storeA] = await db.select().from(stores).where(and(eq(stores.name, "Store A"), eq(stores.organization_id, orgA.id))).limit(1);
  if (!storeA) {
    [storeA] = await db.insert(stores).values({ organization_id: orgA.id, name: "Store A", phone: "9990000001", gst_number: "27AAAAA1111A1Z1", address: "101 Alpha St" }).returning();
  }

  // Org B
  let [orgB] = await db.select().from(organizations).where(eq(organizations.name, "Tenant Test Org B")).limit(1);
  if (!orgB) {
    [orgB] = await db.insert(organizations).values({ name: "Tenant Test Org B", phone: "9990000002", gst_number: "27BBBBB2222B1Z2" }).returning();
  }
  let [storeB] = await db.select().from(stores).where(and(eq(stores.name, "Store B"), eq(stores.organization_id, orgB.id))).limit(1);
  if (!storeB) {
    [storeB] = await db.insert(stores).values({ organization_id: orgB.id, name: "Store B", phone: "9990000002", gst_number: "27BBBBB2222B1Z2", address: "202 Beta St" }).returning();
  }

  // Org C
  let [orgC] = await db.select().from(organizations).where(eq(organizations.name, "Tenant Test Org C")).limit(1);
  if (!orgC) {
    [orgC] = await db.insert(organizations).values({ name: "Tenant Test Org C", phone: "9990000003", gst_number: "27CCCCC3333C1Z3" }).returning();
  }
  let [storeC] = await db.select().from(stores).where(and(eq(stores.name, "Store C"), eq(stores.organization_id, orgC.id))).limit(1);
  if (!storeC) {
    [storeC] = await db.insert(stores).values({ organization_id: orgC.id, name: "Store C", phone: "9990000003", gst_number: "27CCCCC3333C1Z3", address: "303 Gamma St" }).returning();
  }

  // Store Custom Branding Settings
  await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA.id, userId: 1, role: "admin" }, async () => {
    await settingsRepo.setMany({ shop_name: "Custom Brand A", shop_phone: "9990000001", shop_gstin: "27AAAAA1111A1Z1" });
  });
  await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB.id, userId: 1, role: "admin" }, async () => {
    await settingsRepo.setMany({ shop_name: "Custom Brand B", shop_phone: "9990000002", shop_gstin: "27BBBBB2222B1Z2" });
  });
  await storeStorage.run({ organizationId: orgC.id, currentStoreId: storeC.id, userId: 1, role: "admin" }, async () => {
    await settingsRepo.setMany({ shop_name: "Custom Brand C", shop_phone: "9990000003", shop_gstin: "27CCCCC3333C1Z3" });
  });

  console.log("   Org A Store A ID:", storeA.id);
  console.log("   Org B Store B ID:", storeB.id);
  console.log("   Org C Store C ID:", storeC.id);

  // 2. Verify Settings Isolation across 3 Tenants
  console.log("\n2️⃣ Testing Settings & Branding Isolation...");

  const brandA = await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA.id, userId: 1, role: "admin" }, async () => {
    return await settingsRepo.getAll();
  });

  const brandB = await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB.id, userId: 1, role: "admin" }, async () => {
    return await settingsRepo.getAll();
  });

  const brandC = await storeStorage.run({ organizationId: orgC.id, currentStoreId: storeC.id, userId: 1, role: "admin" }, async () => {
    return await settingsRepo.getAll();
  });

  console.log("   Brand A Shop Name:", brandA.shop_name, "(Expected: Custom Brand A)");
  console.log("   Brand B Shop Name:", brandB.shop_name, "(Expected: Custom Brand B)");
  console.log("   Brand C Shop Name:", brandC.shop_name, "(Expected: Custom Brand C)");

  if (brandA.shop_name !== "Custom Brand A" || brandB.shop_name !== "Custom Brand B" || brandC.shop_name !== "Custom Brand C") {
    throw new Error("❌ FAILURE: Branding leaked across tenants in settings repository!");
  }
  console.log("   ✅ PASS: Settings & Branding isolation verified across 3 organizations!");

  // 3. Create Sample Sales for Org A, B, and C
  console.log("\n3️⃣ Creating Sales for Org A, B, and C...");

  const invA = `INV-TEST-A-${timestamp}`;
  const [saleA] = await db.insert(sales).values({
    organization_id: orgA.id,
    store_id: storeA.id,
    invoice_number: invA,
    subtotal: 1000,
    discount: 0,
    gst: 0,
    grand_total: 1000,
    payment_method: "Cash",
    status: "completed",
  }).returning();

  const invB = `INV-TEST-B-${timestamp}`;
  const [saleB] = await db.insert(sales).values({
    organization_id: orgB.id,
    store_id: storeB.id,
    invoice_number: invB,
    subtotal: 2000,
    discount: 0,
    gst: 0,
    grand_total: 2000,
    payment_method: "UPI",
    status: "completed",
  }).returning();

  const invC = `INV-TEST-C-${timestamp}`;
  const [saleC] = await db.insert(sales).values({
    organization_id: orgC.id,
    store_id: storeC.id,
    invoice_number: invC,
    subtotal: 3000,
    discount: 0,
    gst: 0,
    grand_total: 3000,
    payment_method: "Card",
    status: "completed",
  }).returning();

  // 4. Test ReceiptBuilderService Tenant Isolation
  console.log("\n4️⃣ Testing ReceiptBuilderService Tenant Isolation...");

  // Org A user fetching Org A sale -> SUCCESS
  const dtoA = await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA.id, userId: 1, role: "admin" }, async () => {
    return await ReceiptBuilderService.buildReceipt(invA);
  });
  console.log("   DTO A Shop Name:", dtoA.branding.shopName, "| GST:", dtoA.branding.gstin);
  if (dtoA.branding.shopName !== "Custom Brand A" || dtoA.branding.gstin !== "27AAAAA1111A1Z1") {
    throw new Error(`❌ FAILURE: DTO A returned wrong branding! Received: ${dtoA.branding.shopName}`);
  }

  // Org B user fetching Org B sale -> SUCCESS
  const dtoB = await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB.id, userId: 1, role: "admin" }, async () => {
    return await ReceiptBuilderService.buildReceipt(invB);
  });
  console.log("   DTO B Shop Name:", dtoB.branding.shopName, "| GST:", dtoB.branding.gstin);
  if (dtoB.branding.shopName !== "Custom Brand B" || dtoB.branding.gstin !== "27BBBBB2222B1Z2") {
    throw new Error(`❌ FAILURE: DTO B returned wrong branding! Received: ${dtoB.branding.shopName}`);
  }

  // Org C user fetching Org C sale -> SUCCESS
  const dtoC = await storeStorage.run({ organizationId: orgC.id, currentStoreId: storeC.id, userId: 1, role: "admin" }, async () => {
    return await ReceiptBuilderService.buildReceipt(invC);
  });
  console.log("   DTO C Shop Name:", dtoC.branding.shopName, "| GST:", dtoC.branding.gstin);
  if (dtoC.branding.shopName !== "Custom Brand C" || dtoC.branding.gstin !== "27CCCCC3333C1Z3") {
    throw new Error(`❌ FAILURE: DTO C returned wrong branding! Received: ${dtoC.branding.shopName}`);
  }

  // Cross-tenant lookup check: Org A user attempting to fetch Org B's sale ID -> MUST FAIL / NOT FOUND
  console.log("\n5️⃣ Testing Cross-Tenant Boundary Rejection...");
  try {
    await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA.id, userId: 1, role: "admin" }, async () => {
      await ReceiptBuilderService.buildReceipt(invB);
    });
    throw new Error("❌ FAILURE: Org A was able to access Org B's sale!");
  } catch (err: any) {
    if (err.message.includes("FAILURE")) throw err;
    console.log("   ✅ PASS: Org A request for Org B sale properly blocked with NotFoundError!");
  }

  console.log("\n==================================================");
  console.log("🎉 ALL MULTI-TENANT BRANDING ISOLATION TESTS PASSED!");
  console.log("==================================================");
}

runMultiTenantBrandingVerification()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
