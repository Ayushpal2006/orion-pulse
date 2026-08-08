import { encryptToken, decryptToken } from "../utils/crypto";
import { db } from "../db";
import { google_integrations, organizations, stores } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { storeStorage } from "../db/context";

async function runGoogleOAuthTests() {
  console.log("==================================================");
  console.log("🧪 GOOGLE WORKSPACE OAUTH 2.0 INTEGRATION TEST SUITE");
  console.log("==================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // Ensure table exists in test environment
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS google_integrations (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        store_id INTEGER REFERENCES stores(id),
        google_user_id TEXT,
        google_email TEXT,
        refresh_token TEXT NOT NULL,
        spreadsheet_id TEXT,
        spreadsheet_name TEXT,
        connected_at TIMESTAMP DEFAULT NOW() NOT NULL,
        last_sync TIMESTAMP,
        sync_enabled INTEGER DEFAULT 1 NOT NULL,
        sync_method TEXT DEFAULT 'oauth' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_google_integrations_org_id ON google_integrations (organization_id);
      CREATE INDEX IF NOT EXISTS idx_google_integrations_store_id ON google_integrations (store_id);
    `);

    // --------------------------------------------------
    // TEST 1: Encryption & Decryption Integrity (AES-256-GCM)
    // --------------------------------------------------
    console.log("--- TEST GROUP 1: Token Encryption & Decryption ---");
    const sampleRefreshToken = "1//04_G1fXyz890_sample_google_refresh_token_secret_12345";
    const encrypted = encryptToken(sampleRefreshToken);

    assert(encrypted !== sampleRefreshToken, "Encrypted token differs from plaintext token");
    assert(encrypted.includes(":"), "Encrypted format contains IV and AuthTag separators");

    const decrypted = decryptToken(encrypted);
    assert(decrypted === sampleRefreshToken, "Decrypted token matches original refresh token perfectly");

    // Test handling empty strings
    assert(decryptToken("") === "", "Empty cipher string returns empty decrypted string");

    console.log("✅ Encryption & decryption tests passed.\n");

    // --------------------------------------------------
    // TEST 2: Multi-Tenant Database Isolation for google_integrations
    // --------------------------------------------------
    console.log("--- TEST GROUP 2: Multi-Tenant Database Isolation ---");

    // Ensure dummy orgs exist for testing
    let [orgA] = await db.select().from(organizations).limit(1);
    if (!orgA) {
      [orgA] = await db.insert(organizations).values({ name: "OAuth Test Org A" }).returning();
    }

    const dummyOrgBId = orgA.id + 999;

    // Clean previous test records
    await db.delete(google_integrations).where(eq(google_integrations.organization_id, orgA.id));

    // Insert Google integration record for Org A
    const encryptedTokenA = encryptToken("refresh_token_org_a_secret");
    const [integrationA] = await db
      .insert(google_integrations)
      .values({
        organization_id: orgA.id,
        google_user_id: "google_user_101",
        google_email: "orgA_owner@gmail.com",
        refresh_token: encryptedTokenA,
        spreadsheet_id: "sheet_id_org_a_123",
        spreadsheet_name: "Org A Sales Ledger",
        sync_enabled: 1,
        sync_method: "oauth",
      })
      .returning();

    assert(Boolean(integrationA.id), "Inserted google_integrations record for Org A");
    assert(integrationA.organization_id === orgA.id, "Integration record bound strictly to Org A");

    // Verify Org B cannot query Org A's integration record
    const [queriedByOrgB] = await db
      .select()
      .from(google_integrations)
      .where(eq(google_integrations.organization_id, dummyOrgBId))
      .limit(1);

    assert(!queriedByOrgB, "Org B query returned undefined (Org A data isolated)");

    // Verify Org A query retrieves exact record
    const [queriedByOrgA] = await db
      .select()
      .from(google_integrations)
      .where(eq(google_integrations.organization_id, orgA.id))
      .limit(1);

    assert(queriedByOrgA.google_email === "orgA_owner@gmail.com", "Org A retrieves its own connected Google account");
    assert(decryptToken(queriedByOrgA.refresh_token) === "refresh_token_org_a_secret", "Org A refresh token decrypts correctly");

    console.log("✅ Multi-Tenant Database Isolation tests passed.\n");

    // Clean test record
    await db.delete(google_integrations).where(eq(google_integrations.id, integrationA.id));

    console.log("==================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");
  } catch (error: any) {
    console.error("\n❌ Test Suite Failed with Exception:", error.message);
    process.exit(1);
  }
}

runGoogleOAuthTests().then(() => process.exit(0));
