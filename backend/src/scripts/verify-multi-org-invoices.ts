import { db } from "../db";
import { organizations, stores, settings, sales, sale_items, products, customers, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { storeStorage } from "../db/context";
import { SalesService } from "../services/sales.service";
import { PdfService } from "../services/pdf.service";
import { PostgresSettingsRepository } from "../repositories/postgres/settings.repository";
import path from "path";
import fs from "fs";

async function verifyMultiOrgInvoices() {
  console.log("==================================================================");
  console.log("🔥 MANDATORY MULTI-ORGANIZATION INVOICE QA VERIFICATION");
  console.log("==================================================================");

  const settingsRepo = new PostgresSettingsRepository();
  const salesService = new SalesService();
  const pdfService = new PdfService();

  // 1. Create or retrieve Organization A
  let [orgA] = await db.select().from(organizations).where(eq(organizations.name, "Apex Traders Org A")).limit(1);
  if (!orgA) {
    [orgA] = await db
      .insert(organizations)
      .values({
        name: "Apex Traders Org A",
        slug: "apex-traders-org-a",
        gst_number: "27APEXA1111A1Z1",
        address: "Building 1, Tech Park, Mumbai 400001",
        phone: "9876543210",
        email: "contact@apextraders.com",
        status: "active",
        billing_plan: "Professional",
        subscription_status: "active",
        invoice_prefix: "APX-",
      })
      .returning();
  }

  let [storeA] = await db.select().from(stores).where(eq(stores.organization_id, orgA.id)).limit(1);
  if (!storeA) {
    [storeA] = await db
      .insert(stores)
      .values({
        organization_id: orgA.id,
        name: "Apex Mumbai Main Store",
        code: "STR-APX-01",
        gst_number: "27APEXA1111A1Z1",
        address: "Building 1, Tech Park, Mumbai 400001",
        phone: "9876543210",
        is_default: 1,
        status: "active",
      })
      .returning();
  }

  // Seed Org A settings
  await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA.id, userId: 1, role: "owner" }, async () => {
    await settingsRepo.setMany({
      shop_name: "Apex Traders Org A",
      shop_gstin: "27APEXA1111A1Z1",
      shop_address: "Building 1, Tech Park, Mumbai 400001",
      shop_phone: "9876543210",
      shop_email: "contact@apextraders.com",
      receipt_template: "Modern",
      inv_prefix: "APX-",
      receipt_footer: "Thank you for shopping at Apex Traders Org A!",
      invoice_header: "APEX TAX INVOICE",
      primary_color: "#2563eb",
    });
  });

  // 2. Create or retrieve Organization B
  let [orgB] = await db.select().from(organizations).where(eq(organizations.name, "Zenith Retail Org B")).limit(1);
  if (!orgB) {
    [orgB] = await db
      .insert(organizations)
      .values({
        name: "Zenith Retail Org B",
        slug: "zenith-retail-org-b",
        gst_number: "19ZENIB2222B2Z2",
        address: "Sector 5, Salt Lake, Kolkata 700091",
        phone: "8765432109",
        email: "support@zenithretail.com",
        status: "active",
        billing_plan: "Professional",
        subscription_status: "active",
        invoice_prefix: "ZNT-",
      })
      .returning();
  }

  let [storeB] = await db.select().from(stores).where(eq(stores.organization_id, orgB.id)).limit(1);
  if (!storeB) {
    [storeB] = await db
      .insert(stores)
      .values({
        organization_id: orgB.id,
        name: "Zenith Kolkata Main Store",
        code: "STR-ZNT-01",
        gst_number: "19ZENIB2222B2Z2",
        address: "Sector 5, Salt Lake, Kolkata 700091",
        phone: "8765432109",
        is_default: 1,
        status: "active",
      })
      .returning();
  }

  // Seed Org B settings
  await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB.id, userId: 1, role: "owner" }, async () => {
    await settingsRepo.setMany({
      shop_name: "Zenith Retail Org B",
      shop_gstin: "19ZENIB2222B2Z2",
      shop_address: "Sector 5, Salt Lake, Kolkata 700091",
      shop_phone: "8765432109",
      shop_email: "support@zenithretail.com",
      receipt_template: "GST Professional",
      inv_prefix: "ZNT-",
      receipt_footer: "Visit again — Zenith Retail Org B!",
      invoice_header: "ZENITH B2B TAX INVOICE",
      primary_color: "#047857",
    });
  });

  console.log("✅ Organization A & B seeded in database.");
  console.log(`- Org A: ID ${orgA.id}, Store ${storeA.id}, GST: 27APEXA1111A1Z1, Template: Modern`);
  console.log(`- Org B: ID ${orgB.id}, Store ${storeB.id}, GST: 19ZENIB2222B2Z2, Template: GST Professional`);

  // 3. Create Product for Org A & Sale for Org A
  let saleAReceipt: any = null;
  await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA.id, userId: 1, role: "owner" }, async () => {
    let [prodA] = await db
      .select()
      .from(products)
      .where(eq(products.organization_id, orgA.id))
      .limit(1);

    if (!prodA) {
      [prodA] = await db
        .insert(products)
        .values({
          organization_id: orgA.id,
          store_id: storeA.id,
          name: "Wireless Mouse Org A Spec",
          sku: "APX-MSE-01",
          selling_price: 150000,
          purchase_price: 100000,
          stock: 100,
          gst: 18,
        })
        .returning();
    }

    const ts = Date.now();
    const invNo = `APX-${ts}`;
    const [saleA] = await db
      .insert(sales)
      .values({
        organization_id: orgA.id,
        store_id: storeA.id,
        invoice_number: invNo,
        subtotal: 150000,
        discount: 0,
        gst: 27000,
        grand_total: 177000,
        payment_method: "UPI",
        cashier_name: "Apex Cashier",
        status: "COMPLETED",
        public_token: `pub-apx-${ts}`,
      })
      .returning();

    await db.insert(sale_items).values({
      organization_id: orgA.id,
      store_id: storeA.id,
      sale_id: saleA.id,
      product_id: prodA.id,
      quantity: 1,
      selling_price: 150000,
      discount: 0,
      line_total: 150000,
    });

    saleAReceipt = await salesService.getReceipt(saleA.invoice_number);
  });

  // 4. Create Product for Org B & Sale for Org B
  let saleBReceipt: any = null;
  await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB.id, userId: 1, role: "owner" }, async () => {
    let [prodB] = await db
      .select()
      .from(products)
      .where(eq(products.organization_id, orgB.id))
      .limit(1);

    if (!prodB) {
      [prodB] = await db
        .insert(products)
        .values({
          organization_id: orgB.id,
          store_id: storeB.id,
          name: "Mechanical Keyboard Org B Spec",
          sku: "ZNT-KBD-01",
          selling_price: 350000,
          purchase_price: 250000,
          stock: 50,
          gst: 18,
        })
        .returning();
    }

    const ts = Date.now();
    const invNo = `ZNT-${ts}`;
    const [saleB] = await db
      .insert(sales)
      .values({
        organization_id: orgB.id,
        store_id: storeB.id,
        invoice_number: invNo,
        subtotal: 350000,
        discount: 0,
        gst: 63000,
        grand_total: 413000,
        payment_method: "Cash",
        cashier_name: "Zenith Cashier",
        status: "COMPLETED",
        public_token: `pub-znt-${ts}`,
      })
      .returning();

    await db.insert(sale_items).values({
      organization_id: orgB.id,
      store_id: storeB.id,
      sale_id: saleB.id,
      product_id: prodB.id,
      quantity: 1,
      selling_price: 350000,
      discount: 0,
      line_total: 350000,
    });

    saleBReceipt = await salesService.getReceipt(saleB.invoice_number);
  });

  console.log("\n==================================================");
  console.log("🔍 AUDITING GENERATED INVOICE DATA MODEL & TEMPLATES");
  console.log("==================================================");

  console.log("\n--- Organization A Invoice Output ---");
  console.log(`Invoice Number : ${saleAReceipt.invoiceNumber}`);
  console.log(`Business Name  : ${saleAReceipt.shop.name}`);
  console.log(`GSTIN          : ${saleAReceipt.shop.gstin}`);
  console.log(`Address        : ${saleAReceipt.shop.address}`);
  console.log(`Phone          : ${saleAReceipt.shop.phone}`);
  console.log(`Template       : ${saleAReceipt.template}`);
  console.log(`Footer         : ${saleAReceipt.thankYouMessage}`);

  console.log("\n--- Organization B Invoice Output ---");
  console.log(`Invoice Number : ${saleBReceipt.invoiceNumber}`);
  console.log(`Business Name  : ${saleBReceipt.shop.name}`);
  console.log(`GSTIN          : ${saleBReceipt.shop.gstin}`);
  console.log(`Address        : ${saleBReceipt.shop.address}`);
  console.log(`Phone          : ${saleBReceipt.shop.phone}`);
  console.log(`Template       : ${saleBReceipt.template}`);
  console.log(`Footer         : ${saleBReceipt.thankYouMessage}`);

  // 5. Generate PDFs for both organizations
  const artifactsDir = "/Users/ayush/.gemini/antigravity-ide/brain/f675723a-7549-47c3-8a5e-daae0957e2b4";
  const pdfPathA = path.join(artifactsDir, `org_a_invoice_${saleAReceipt.invoiceNumber}.pdf`);
  const pdfPathB = path.join(artifactsDir, `org_b_invoice_${saleBReceipt.invoiceNumber}.pdf`);

  await storeStorage.run({ organizationId: orgA.id, currentStoreId: storeA.id, userId: 1, role: "owner" }, async () => {
    await pdfService.generateInvoicePdf(saleAReceipt, pdfPathA);
  });

  await storeStorage.run({ organizationId: orgB.id, currentStoreId: storeB.id, userId: 1, role: "owner" }, async () => {
    await pdfService.generateInvoicePdf(saleBReceipt, pdfPathB);
  });

  console.log("\n==================================================");
  console.log("📄 PDF GENERATION VERIFICATION");
  console.log("==================================================");
  console.log(`Org A PDF Generated: ${fs.existsSync(pdfPathA) ? "PASS ✅" : "FAIL ❌"} (${pdfPathA})`);
  console.log(`Org B PDF Generated: ${fs.existsSync(pdfPathB) ? "PASS ✅" : "FAIL ❌"} (${pdfPathB})`);

  // Assertions
  if (saleAReceipt.shop.name !== "Apex Traders Org A") throw new Error(`Org A Shop Name Mismatch! Got: ${saleAReceipt.shop.name}`);
  if (saleAReceipt.shop.gstin !== "27APEXA1111A1Z1") throw new Error(`Org A GST Mismatch! Got: ${saleAReceipt.shop.gstin}`);
  if (saleAReceipt.template !== "Modern") throw new Error(`Org A Template Mismatch! Got: ${saleAReceipt.template}`);

  if (saleBReceipt.shop.name !== "Zenith Retail Org B") throw new Error(`Org B Shop Name Mismatch! Got: ${saleBReceipt.shop.name}`);
  if (saleBReceipt.shop.gstin !== "19ZENIB2222B2Z2") throw new Error(`Org B GST Mismatch! Got: ${saleBReceipt.shop.gstin}`);
  if (saleBReceipt.template !== "GST Professional") throw new Error(`Org B Template Mismatch! Got: ${saleBReceipt.template}`);

  console.log("\n==================================================");
  console.log("✨ ALL MULTI-TENANT ORGANISATION & TEMPLATE ASSERTS PASSED 100%!");
  console.log("==================================================");

  process.exit(0);
}

verifyMultiOrgInvoices().catch((err) => {
  console.error("Multi-org QA script error:", err);
  process.exit(1);
});
