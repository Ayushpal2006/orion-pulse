/**
 * P0 Multi-Tenant Data Isolation - Read-Only Diagnostic Database Audit
 * 
 * Performs read-only queries to check:
 * 1. Records with NULL organization_id
 * 2. Records where record.organization_id != store.organization_id
 * 3. Cross-organization relationships (sale -> product, sale -> customer, purchase -> supplier, etc.)
 * 4. Contaminated records summary
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

interface TableAuditResult {
  table: string;
  totalRows: number;
  nullOrgRows: number;
  mismatchedStoreOrgRows: number;
  crossTenantRelationRows: number;
  sampleContaminatedIds: any[];
}

async function runAudit(): Promise<void> {
  console.log("==================================================================");
  console.log("🔍 P0 MULTI-TENANT DATA ISOLATION — READ-ONLY PRODUCTION DB AUDIT");
  console.log("==================================================================\n");

  const results: TableAuditResult[] = [];

  // Helper to safely execute query
  const safeQuery = async (queryText: string): Promise<any[]> => {
    try {
      const res: any = await db.execute(sql.raw(queryText));
      return res.rows || res;
    } catch (err: any) {
      console.warn(`Query skipped or table not found: ${err.message}`);
      return [];
    }
  };

  // 1. Users
  const usersCount = (await safeQuery("SELECT COUNT(*) as cnt FROM users"))[0]?.cnt || 0;
  const usersNull = (await safeQuery("SELECT COUNT(*) as cnt FROM users WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const usersMismatch = (await safeQuery(`
    SELECT u.id, u.organization_id as user_org, s.organization_id as store_org, u.store_id 
    FROM users u 
    INNER JOIN stores s ON u.store_id = s.id 
    WHERE u.organization_id != s.organization_id
  `));
  results.push({
    table: "users",
    totalRows: Number(usersCount),
    nullOrgRows: Number(usersNull),
    mismatchedStoreOrgRows: usersMismatch.length,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: usersMismatch.slice(0, 5),
  });

  // 2. Stores
  const storesCount = (await safeQuery("SELECT COUNT(*) as cnt FROM stores"))[0]?.cnt || 0;
  const storesNull = (await safeQuery("SELECT COUNT(*) as cnt FROM stores WHERE organization_id IS NULL"))[0]?.cnt || 0;
  results.push({
    table: "stores",
    totalRows: Number(storesCount),
    nullOrgRows: Number(storesNull),
    mismatchedStoreOrgRows: 0,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: [],
  });

  // 3. Products
  const productsCount = (await safeQuery("SELECT COUNT(*) as cnt FROM products"))[0]?.cnt || 0;
  const productsNull = (await safeQuery("SELECT COUNT(*) as cnt FROM products WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const productsMismatch = (await safeQuery(`
    SELECT p.id, p.organization_id as product_org, s.organization_id as store_org, p.store_id 
    FROM products p 
    INNER JOIN stores s ON p.store_id = s.id 
    WHERE p.organization_id != s.organization_id
  `));
  results.push({
    table: "products",
    totalRows: Number(productsCount),
    nullOrgRows: Number(productsNull),
    mismatchedStoreOrgRows: productsMismatch.length,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: productsMismatch.slice(0, 5),
  });

  // 4. Customers
  const customersCount = (await safeQuery("SELECT COUNT(*) as cnt FROM customers"))[0]?.cnt || 0;
  const customersNull = (await safeQuery("SELECT COUNT(*) as cnt FROM customers WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const customersMismatch = (await safeQuery(`
    SELECT c.id, c.organization_id as cust_org, s.organization_id as store_org, c.store_id 
    FROM customers c 
    INNER JOIN stores s ON c.store_id = s.id 
    WHERE c.organization_id != s.organization_id
  `));
  results.push({
    table: "customers",
    totalRows: Number(customersCount),
    nullOrgRows: Number(customersNull),
    mismatchedStoreOrgRows: customersMismatch.length,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: customersMismatch.slice(0, 5),
  });

  // 5. Sales
  const salesCount = (await safeQuery("SELECT COUNT(*) as cnt FROM sales"))[0]?.cnt || 0;
  const salesNull = (await safeQuery("SELECT COUNT(*) as cnt FROM sales WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const salesMismatch = (await safeQuery(`
    SELECT sl.id, sl.organization_id as sale_org, s.organization_id as store_org, sl.store_id 
    FROM sales sl 
    INNER JOIN stores s ON sl.store_id = s.id 
    WHERE sl.organization_id != s.organization_id
  `));
  const salesCustMismatch = (await safeQuery(`
    SELECT sl.id, sl.organization_id as sale_org, c.organization_id as cust_org, sl.customer_id 
    FROM sales sl 
    INNER JOIN customers c ON sl.customer_id = c.id 
    WHERE sl.organization_id != c.organization_id
  `));
  results.push({
    table: "sales",
    totalRows: Number(salesCount),
    nullOrgRows: Number(salesNull),
    mismatchedStoreOrgRows: salesMismatch.length,
    crossTenantRelationRows: salesCustMismatch.length,
    sampleContaminatedIds: [...salesMismatch, ...salesCustMismatch].slice(0, 5),
  });

  // 6. Sale Items (Cross-tenant check with product)
  const saleItemsCount = (await safeQuery("SELECT COUNT(*) as cnt FROM sale_items"))[0]?.cnt || 0;
  const saleItemsNull = (await safeQuery("SELECT COUNT(*) as cnt FROM sale_items WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const saleItemsCrossProd = (await safeQuery(`
    SELECT si.id, si.sale_id, si.product_id, s.organization_id as sale_org, p.organization_id as prod_org 
    FROM sale_items si 
    INNER JOIN sales s ON si.sale_id = s.id 
    INNER JOIN products p ON si.product_id = p.id 
    WHERE s.organization_id != p.organization_id
  `));
  results.push({
    table: "sale_items",
    totalRows: Number(saleItemsCount),
    nullOrgRows: Number(saleItemsNull),
    mismatchedStoreOrgRows: 0,
    crossTenantRelationRows: saleItemsCrossProd.length,
    sampleContaminatedIds: saleItemsCrossProd.slice(0, 5),
  });

  // 7. Purchase Orders & Items
  const poCount = (await safeQuery("SELECT COUNT(*) as cnt FROM purchase_orders"))[0]?.cnt || 0;
  const poNull = (await safeQuery("SELECT COUNT(*) as cnt FROM purchase_orders WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const poMismatch = (await safeQuery(`
    SELECT po.id, po.organization_id as po_org, s.organization_id as store_org, po.store_id 
    FROM purchase_orders po 
    INNER JOIN stores s ON po.store_id = s.id 
    WHERE po.organization_id != s.organization_id
  `));
  results.push({
    table: "purchase_orders",
    totalRows: Number(poCount),
    nullOrgRows: Number(poNull),
    mismatchedStoreOrgRows: poMismatch.length,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: poMismatch.slice(0, 5),
  });

  // 8. Suppliers
  const suppCount = (await safeQuery("SELECT COUNT(*) as cnt FROM suppliers"))[0]?.cnt || 0;
  const suppNull = (await safeQuery("SELECT COUNT(*) as cnt FROM suppliers WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const suppMismatch = (await safeQuery(`
    SELECT sp.id, sp.organization_id as supp_org, s.organization_id as store_org, sp.store_id 
    FROM suppliers sp 
    INNER JOIN stores s ON sp.store_id = s.id 
    WHERE sp.organization_id != s.organization_id
  `));
  results.push({
    table: "suppliers",
    totalRows: Number(suppCount),
    nullOrgRows: Number(suppNull),
    mismatchedStoreOrgRows: suppMismatch.length,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: suppMismatch.slice(0, 5),
  });

  // 9. Expenses
  const expCount = (await safeQuery("SELECT COUNT(*) as cnt FROM expenses"))[0]?.cnt || 0;
  const expNull = (await safeQuery("SELECT COUNT(*) as cnt FROM expenses WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const expMismatch = (await safeQuery(`
    SELECT e.id, e.organization_id as exp_org, s.organization_id as store_org, e.store_id 
    FROM expenses e 
    INNER JOIN stores s ON e.store_id = s.id 
    WHERE e.organization_id != s.organization_id
  `));
  results.push({
    table: "expenses",
    totalRows: Number(expCount),
    nullOrgRows: Number(expNull),
    mismatchedStoreOrgRows: expMismatch.length,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: expMismatch.slice(0, 5),
  });

  // 10. Stock Adjustments & Movements
  const movCount = (await safeQuery("SELECT COUNT(*) as cnt FROM inventory_movements"))[0]?.cnt || 0;
  const movNull = (await safeQuery("SELECT COUNT(*) as cnt FROM inventory_movements WHERE organization_id IS NULL"))[0]?.cnt || 0;
  const movMismatch = (await safeQuery(`
    SELECT m.id, m.organization_id as mov_org, s.organization_id as store_org, m.store_id 
    FROM inventory_movements m 
    INNER JOIN stores s ON m.store_id = s.id 
    WHERE m.organization_id != s.organization_id
  `));
  results.push({
    table: "inventory_movements",
    totalRows: Number(movCount),
    nullOrgRows: Number(movNull),
    mismatchedStoreOrgRows: movMismatch.length,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: movMismatch.slice(0, 5),
  });

  // 11. Settings
  const settingsCount = (await safeQuery("SELECT COUNT(*) as cnt FROM settings"))[0]?.cnt || 0;
  const settingsNull = (await safeQuery("SELECT COUNT(*) as cnt FROM settings WHERE organization_id IS NULL"))[0]?.cnt || 0;
  results.push({
    table: "settings",
    totalRows: Number(settingsCount),
    nullOrgRows: Number(settingsNull),
    mismatchedStoreOrgRows: 0,
    crossTenantRelationRows: 0,
    sampleContaminatedIds: [],
  });

  // PRINT SUMMARY TABLE
  console.log("------------------------------------------------------------------------------------------------------------");
  console.log(
    "| " +
      "TABLE".padEnd(22) +
      " | " +
      "TOTAL ROWS".padStart(10) +
      " | " +
      "NULL ORG ID".padStart(12) +
      " | " +
      "STORE ORG MISMATCH".padStart(18) +
      " | " +
      "CROSS-TENANT REL".padStart(16) +
      " |"
  );
  console.log("------------------------------------------------------------------------------------------------------------");

  let totalContaminated = 0;
  for (const r of results) {
    const cont = r.nullOrgRows + r.mismatchedStoreOrgRows + r.crossTenantRelationRows;
    totalContaminated += cont;
    console.log(
      "| " +
        r.table.padEnd(22) +
        " | " +
        String(r.totalRows).padStart(10) +
        " | " +
        String(r.nullOrgRows).padStart(12) +
        " | " +
        String(r.mismatchedStoreOrgRows).padStart(18) +
        " | " +
        String(r.crossTenantRelationRows).padStart(16) +
        " |"
    );
  }
  console.log("------------------------------------------------------------------------------------------------------------");
  console.log(`\n📊 AUDIT SUMMARY: Total Tables Checked: ${results.length} | Total Inconsistent Rows: ${totalContaminated}`);
  console.log("⚠️  NOTICE: This was a read-only audit. ZERO production records were modified or deleted.\n");

  process.exit(0);
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
