import { db } from "../db";
import { organizations, stores, settings } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { PostgresSettingsRepository } from "../repositories/postgres/settings.repository";
import { BrandingService } from "../services/branding.service";
import { storeStorage } from "../db/context";

async function runSettingsPersistenceTest() {
  console.log("================================================================================");
  console.log("🧪 CRITICAL P0 PRODUCTION TEST: STORE SETTINGS PERSISTENCE & SOURCE OF TRUTH");
  console.log("================================================================================\n");

  const settingsRepo = new PostgresSettingsRepository();

  // 1. Provision a test organization and store
  let [org] = await db.select().from(organizations).where(eq(organizations.name, "Settings Test Org")).limit(1);
  if (!org) {
    [org] = await db.insert(organizations).values({ name: "Settings Test Org", phone: "9876543210", gst_number: "07AAAAA1111A1Z1" }).returning();
  }

  let [store] = await db.select().from(stores).where(and(eq(stores.name, "Settings Test Store"), eq(stores.organization_id, org.id))).limit(1);
  if (!store) {
    [store] = await db.insert(stores).values({ organization_id: org.id, name: "Settings Test Store", phone: "9876543210", gst_number: "07AAAAA1111A1Z1", address: "100 Initial Ave" }).returning();
  }

  const context = { organizationId: org.id, currentStoreId: store.id, userId: 1, role: "admin" };

  // TEST 1: Save store name, address, phone, logo, and UPI VPA
  console.log("▶ TEST 1: Save store name, address, phone, logo, and UPI VPA...");
  await storeStorage.run(context, async () => {
    await settingsRepo.setMany({
      shop_name: "PAL GARMENTS",
      shop_address: "Shop 4, MG Road, New Delhi",
      shop_phone: "9811122233",
      logo: "https://res.cloudinary.com/demo/image/upload/pal_logo.png",
      shop_upi_id: "palgarments@okhdfcbank",
      shop_gstin: "07AAAAA9999A1Z9",
      inv_prefix: "PG-INV-",
    });
  });
  console.log("  ✓ TEST 1 PASSED: Initial full settings saved to database.\n");

  // TEST 2: Refresh web application (Read from database)
  console.log("▶ TEST 2: Read settings (Simulating web app refresh / load)...");
  let loadedSettings: Record<string, string> = {};
  await storeStorage.run(context, async () => {
    loadedSettings = await settingsRepo.getAll();
  });

  if (
    loadedSettings.shop_name === "PAL GARMENTS" &&
    loadedSettings.shop_address === "Shop 4, MG Road, New Delhi" &&
    loadedSettings.shop_phone === "9811122233" &&
    loadedSettings.logo === "https://res.cloudinary.com/demo/image/upload/pal_logo.png" &&
    loadedSettings.shop_upi_id === "palgarments@okhdfcbank" &&
    loadedSettings.shop_gstin === "07AAAAA9999A1Z9"
  ) {
    console.log("  ✓ TEST 2 PASSED: Web app refresh loaded exact persisted database values.\n");
  } else {
    throw new Error(`TEST 2 FAILED: Mismatched settings on refresh: ${JSON.stringify(loadedSettings)}`);
  }

  // TEST 3: Close and reopen application (Simulate fresh repository instance and store query)
  console.log("▶ TEST 3: Fresh repository instance reading from store context...");
  const freshRepo = new PostgresSettingsRepository();
  let freshLoaded: Record<string, string> = {};
  await storeStorage.run(context, async () => {
    freshLoaded = await freshRepo.getAll();
  });

  if (
    freshLoaded.shop_name === "PAL GARMENTS" &&
    freshLoaded.shop_upi_id === "palgarments@okhdfcbank" &&
    freshLoaded.logo === "https://res.cloudinary.com/demo/image/upload/pal_logo.png"
  ) {
    console.log("  ✓ TEST 3 PASSED: Fresh session cleanly loaded exact persisted settings.\n");
  } else {
    throw new Error(`TEST 3 FAILED: Fresh repo failed to retrieve settings.`);
  }

  // TEST 4: Partial Update - Change ONLY UPI VPA
  console.log("▶ TEST 4: Partial PATCH - Change ONLY UPI VPA...");
  await storeStorage.run(context, async () => {
    await settingsRepo.setMany({
      shop_upi_id: "palgarments.new@icici",
    });
  });

  let afterUpiUpdate: Record<string, string> = {};
  await storeStorage.run(context, async () => {
    afterUpiUpdate = await settingsRepo.getAll();
  });

  if (
    afterUpiUpdate.shop_upi_id === "palgarments.new@icici" &&
    afterUpiUpdate.shop_name === "PAL GARMENTS" &&
    afterUpiUpdate.shop_address === "Shop 4, MG Road, New Delhi" &&
    afterUpiUpdate.shop_phone === "9811122233" &&
    afterUpiUpdate.logo === "https://res.cloudinary.com/demo/image/upload/pal_logo.png"
  ) {
    console.log("  ✓ TEST 4 PASSED: Only UPI VPA updated; Logo, Store Name, Address & Phone remained intact.\n");
  } else {
    throw new Error(`TEST 4 FAILED: Partial update corrupted other fields: ${JSON.stringify(afterUpiUpdate)}`);
  }

  // TEST 5: Partial Update - Change ONLY Logo
  console.log("▶ TEST 5: Partial PATCH - Change ONLY Logo...");
  await storeStorage.run(context, async () => {
    await settingsRepo.setMany({
      logo: "https://res.cloudinary.com/demo/image/upload/new_pal_logo_v2.png",
    });
  });

  let afterLogoUpdate: Record<string, string> = {};
  await storeStorage.run(context, async () => {
    afterLogoUpdate = await settingsRepo.getAll();
  });

  if (
    afterLogoUpdate.logo === "https://res.cloudinary.com/demo/image/upload/new_pal_logo_v2.png" &&
    afterLogoUpdate.shop_upi_id === "palgarments.new@icici" &&
    afterLogoUpdate.shop_name === "PAL GARMENTS"
  ) {
    console.log("  ✓ TEST 5 PASSED: Only Logo updated; UPI VPA and Store Name remained intact.\n");
  } else {
    throw new Error(`TEST 5 FAILED: Partial logo update corrupted other fields.`);
  }

  // TEST 6 & 7: Receipt Branding & Dynamic UPI QR Generation
  console.log("▶ TEST 6 & 7: Verify Receipt Branding & Dynamic UPI QR Payload...");
  let branding: any = null;
  await storeStorage.run(context, async () => {
    branding = await BrandingService.getBranding(store.id, org.id);
  });

  if (
    branding.businessName === "PAL GARMENTS" &&
    branding.upi === "palgarments.new@icici" &&
    branding.logo === "https://res.cloudinary.com/demo/image/upload/new_pal_logo_v2.png" &&
    branding.qr.includes("pa=palgarments.new%40icici")
  ) {
    console.log("  ✓ TEST 6 PASSED: Receipt branding uses currently persisted store branding.");
    console.log(`  ✓ TEST 7 PASSED: UPI QR correctly generated from updated VPA: ${branding.qr}\n`);
  } else {
    throw new Error(`TEST 6/7 FAILED: Branding service did not resolve updated UPI/Branding: ${JSON.stringify(branding)}`);
  }

  // TEST 8: Check Expo Mobile Compatibility (CamelCase & SnakeCase Aliases)
  console.log("▶ TEST 8: Check Expo Mobile API Compatibility (CamelCase / SnakeCase Aliases)...");
  if (
    afterLogoUpdate.storeName === "PAL GARMENTS" &&
    afterLogoUpdate.address === "Shop 4, MG Road, New Delhi" &&
    afterLogoUpdate.phone === "9811122233" &&
    afterLogoUpdate.logoUrl === "https://res.cloudinary.com/demo/image/upload/new_pal_logo_v2.png" &&
    afterLogoUpdate.upiId === "palgarments.new@icici" &&
    afterLogoUpdate.invoicePrefix === "PG-INV-"
  ) {
    console.log("  ✓ TEST 8 PASSED: Expo Mobile received seamless CamelCase & SnakeCase aliases.\n");
  } else {
    throw new Error(`TEST 8 FAILED: Mobile aliases missing or incorrect: ${JSON.stringify(afterLogoUpdate)}`);
  }

  console.log("================================================================================");
  console.log("🎉 ALL 8 SETTINGS PERSISTENCE & SOURCE OF TRUTH TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================\n");
}

runSettingsPersistenceTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
  });
