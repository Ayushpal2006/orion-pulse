# Manual Inventory Import — Orion POS / Apka Bill

## 1. Purpose

This document is an operational runbook for manually bulk-importing product inventory into a NEW or EXISTING organization/store in **Orion POS / Apka Bill** using CSV/Excel spreadsheets and PostgreSQL (`psql`).

### When to Use This Process
- **Onboarding a New Organization**: Loading an initial product catalog when setting up a new SaaS subscriber/tenant.
- **Onboarding a New Store**: Populating inventory for a newly opened branch/store location.
- **Bulk Catalog Import**: Migrating hundreds or thousands of products from an existing legacy POS or billing system.
- **Excel Stock/Catalog Migration**: Importing structured supplier or shop spreadsheets provided by a store owner.
- **Initial Inventory Initialization**: Setting up opening stock quantities during store launch.

### When NOT to Use This Process
- **Single Product Additions**: Use the Orion POS Web UI (**Products → Add Product**) for day-to-day item creation.
- **Routine Price / Stock Adjustments**: Use the POS interface or stock adjustment dialogs.
- **Historical Sales / Invoice Corrections**: NEVER use inventory import to modify historical sales or invoices. Sales data and inventory receipts must remain immutable.

---

## 2. Safety Rules

> [!CAUTION]
> **CRITICAL MULTI-TENANT SAFETY WARNING**
> Orion POS is a multi-tenant SaaS application. Products, stock, and sales are strictly isolated by `organization_id` and `store_id`. Importing products with an incorrect `organization_id` or `store_id` will cause **cross-tenant data contamination**, leaking products into another business's POS or corrupting inventory levels.

### Mandatory Rules
1. **Always Confirm Database Backup**: Verify a recent backup exists (or create one using `pg_dump`) BEFORE executing any production SQL insert.
2. **Verify `organization_id` and `store_id`**: Always query the database to confirm the exact `organization_id` and `store_id` before starting.
3. **Confirm Store Belongs to Organization**: Run a verification query proving `stores.organization_id = organizations.id`.
4. **Never Use Unscoped UPDATE / DELETE**: Never execute global updates like `UPDATE products SET stock = 100;` or `DELETE FROM products;`. Every write must be scoped with `WHERE organization_id = <ORG_ID> AND store_id = <STORE_ID>`.
5. **Never Assume IDs from Client Files**: Do NOT rely on `organization_id` or `store_id` provided inside client CSV files. Inject verified tenant IDs programmatically during the SQL `INSERT`.
6. **Use a Staging Table**: Always load CSV rows into a temporary staging table (`product_import_staging`) first. Validate staging rows BEFORE inserting into `products`.
7. **Verify Row Counts**: Confirm that staging row counts match the CSV row count before inserting into production.
8. **Wrap Operations in Transactions**: Always execute production inserts inside a `BEGIN ... COMMIT;` transaction block. If validation fails, execute `ROLLBACK;`.
9. **Never Touch Historical Sales**: Do not alter `sales`, `sale_items`, or `invoices` tables during inventory import.

---

## 3. Determine Organization and Store

Before importing, identify the target organization and store IDs.

### List All Organizations
```sql
SELECT id, name, slug, email, status, created_at
FROM organizations
ORDER BY id DESC;
```

### List Stores for a Specific Organization
Replace `<ORG_ID>` with the actual integer ID of the target organization:
```sql
SELECT id, organization_id, name, code, city, status, is_default
FROM stores
WHERE organization_id = <ORG_ID>
ORDER BY id ASC;
```

### Verify Tenant Relationship (MANDATORY)
Run this query to guarantee that `<STORE_ID>` actually belongs to `<ORG_ID>`:
```sql
SELECT 
  s.id AS store_id,
  s.name AS store_name,
  s.code AS store_code,
  o.id AS organization_id,
  o.name AS organization_name
FROM stores s
JOIN organizations o ON s.organization_id = o.id
WHERE s.id = <STORE_ID> 
  AND o.id = <ORG_ID>;
```

> [!IMPORTANT]
> **STOP IF NO ROWS ARE RETURNED.** Do not proceed until you have confirmed the correct `<ORG_ID>` and `<STORE_ID>`.

---

## 4. Required Product Schema

The target `products` table schema in Orion POS (`backend/src/db/schema.ts`) is defined as follows:

| Column Name | Database Type | Nullable? | Default | Required for Import? | Notes / Unit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` (serial) | No | Auto (sequence) | **NO** | Primary Key. Do not supply manually. |
| `organization_id` | `INTEGER` | Yes (DB) / **Yes (App)** | None | **YES (Injected)** | Foreign Key to `organizations.id`. Essential for multi-tenant isolation. |
| `store_id` | `INTEGER` | No | None | **YES (Injected)** | Foreign Key to `stores.id`. NOT NULL. |
| `name` | `TEXT` | No | None | **YES (CSV)** | Product display name. NOT NULL. |
| `sku` | `TEXT` | No | None | **YES (CSV)** | Stock Keeping Unit code. NOT NULL. Scoped by store. |
| `barcode` | `TEXT` | Yes | `NULL` | Optional (CSV) | EAN/UPC/Custom barcode. Scoped by store. |
| `category` | `TEXT` | Yes | `NULL` | Optional (CSV) | Category string name (e.g., "Beverages", "Snacks"). |
| `purchase_price` | `INTEGER` | No | None | **YES (CSV)** | **CRITICAL: STORED IN PAISE** (₹1.00 = 100 paise). |
| `selling_price` | `INTEGER` | No | None | **YES (CSV)** | **CRITICAL: STORED IN PAISE** (₹1.00 = 100 paise). |
| `stock` | `INTEGER` | No | `0` | Optional (CSV) | Current available quantity count. Default 0. |
| `minimum_stock` | `INTEGER` | No | `0` | Optional (CSV) | Low stock alert threshold. Default 0. |
| `gst` | `INTEGER` | No | `18` | Optional (CSV) | GST tax percentage (e.g., 0, 5, 12, 18, 28). Default 18. |
| `is_active` | `INTEGER` | No | `1` | Optional (Injected) | Active status (1 = Active, 0 = Archived). Default 1. |
| `image_url` | `TEXT` | Yes | `NULL` | Optional (CSV) | Public image URL string. |
| `margin_percent` | `INTEGER` | No | `0` | Auto-Calculated | Computed as `((selling - purchase) / selling) * 100`. |
| `markup_percent` | `INTEGER` | No | `0` | Auto-Calculated | Computed as `((selling - purchase) / purchase) * 100`. |
| `average_cost` | `INTEGER` | No | `0` | Auto (Injected) | **STORED IN PAISE**. Set equal to `purchase_price`. |
| `last_purchase_cost` | `INTEGER` | No | `0` | Auto (Injected) | **STORED IN PAISE**. Set equal to `purchase_price`. |
| `max_stock` | `INTEGER` | No | `0` | Auto (Injected) | Maximum stock limit. Default 0. |
| `reorder_quantity` | `INTEGER` | No | `0` | Auto (Injected) | Reorder quantity recommendation. |
| `preferred_supplier_id`| `INTEGER` | Yes | `NULL` | Optional | Foreign Key to `suppliers.id`. |
| `created_at` | `TIMESTAMP` | No | `now()` | Auto | System timestamp. |
| `updated_at` | `TIMESTAMP` | No | `now()` | Auto | System timestamp. |

> [!NOTE]
> **PRICE CONVERSION RULE:** In the CSV, prices should be written in standard Indian Rupees (INR) format (e.g., `150.00`). During the SQL `INSERT`, prices MUST be converted to paise (`ROUND(price * 100)`).

---

## 5. Excel / CSV Template

The CSV file provided by the store manager or prepared by the team should contain only human-readable product columns. Do NOT include `organization_id`, `store_id`, `id`, `created_at`, or calculated margin columns in the spreadsheet.

### Recommended CSV Columns

| Column Name | Required? | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `name` | **Yes** | `Organic Basmati Rice 5kg` | Product title/name. |
| `sku` | **Yes** | `RICE-BAS-005` | Unique product SKU string. |
| `barcode` | Optional | `8901234567890` | EAN/UPC barcode number. |
| `category` | Optional | `Grocery & Staples` | Category display name. |
| `purchase_price` | **Yes** | `450.00` | Cost/Purchase price in **Rupees (INR)**. |
| `selling_price` | **Yes** | `550.00` | Retail/Selling price in **Rupees (INR)**. |
| `stock` | Optional | `50` | Initial opening stock quantity (Integer). Default 0. |
| `minimum_stock` | Optional | `10` | Low stock alert threshold (Integer). Default 0. |
| `gst` | Optional | `5` | Applicable GST percentage (0, 5, 12, 18, 28). Default 18. |

---

## 6. Excel Formatting Rules

To avoid import errors, enforce these spreadsheet preparation rules:

1. **Header Row**: Row 1 must contain exact column names (`name,sku,barcode,category,purchase_price,selling_price,stock,minimum_stock,gst`).
2. **No Merged Cells / Blank Header Rows**: The data table must start on row 2.
3. **No Blank Product Names / SKUs**: Every row must have a non-empty `name`, `sku`, `purchase_price`, and `selling_price`.
4. **Barcode Cell Formatting (CRITICAL)**: Long barcodes (e.g., `8901234567890`) will be converted by Excel into scientific notation (`8.90123E+12`).
   - Select the `barcode` column in Excel → Format Cells → Set Category to **Text** BEFORE entering/pasting barcodes.
5. **Numeric Price Format**: Prices must be pure numbers (e.g., `450.00` or `450`).
   - Remove currency symbols (`₹`, `$`, `Rs.`), commas (`4,500`), or text suffixes.
6. **Integer Quantities**: `stock`, `minimum_stock`, and `gst` must be plain integers (no decimal points).
7. **Encoding**: Save/Export the spreadsheet as **CSV UTF-8 (Comma delimited) (*.csv)**.
   - Excel: **File → Save As → CSV UTF-8 (.csv)**
   - Google Sheets: **File → Download → Comma-separated values (.csv)**

---

## 7. Example CSV

Here is a 5-row sample CSV file (`products_import.csv`):

```csv
name,sku,barcode,category,purchase_price,selling_price,stock,minimum_stock,gst
Organic Basmati Rice 5kg,RICE-BAS-005,8901001001001,Grocery & Staples,450.00,550.00,50,10,5
Cold-Pressed Sunflower Oil 2L,OIL-SUN-002,8901001001002,Packaged Foods,280.00,340.00,30,5,12
Whole Wheat Atta 10kg,ATTA-WHT-010,8901001001003,Grocery & Staples,380.00,480.00,40,10,0
Raw Almonds 500g,NUTS-ALM-500,8901001001004,Dry Fruits,350.00,450.00,25,5,12
Dark Chocolate 85% Cacao 100g,CHOC-DRK-100,8901001001005,Confectionery,120.00,180.00,60,15,18
```

---

## 8. Connect to Production PostgreSQL (Railway / Neon)

Connect to the PostgreSQL database using `psql`.

> [!IMPORTANT]
> Use placeholders (`<DATABASE_URL>`). Never commit or write hardcoded production credentials.

### Connection Command
```bash
psql "<DATABASE_URL>"
```

### Server-side COPY vs. Client-side `\copy`
- PostgreSQL `COPY table FROM '/path'` reads a file located on the **PostgreSQL server's local file system**.
- `psql` metacommand `\copy table FROM '/path'` reads the CSV file from your **local machine** where `psql` is executing.
- **ALWAYS use `\copy`** when uploading a CSV from your Mac/PC to a remote cloud database (Railway / Neon).

Example local path on macOS:
`'/Users/username/Downloads/products_import.csv'`

---

## 9. Create Temporary Staging Import Table

Create a temporary staging table in PostgreSQL to receive the raw CSV data.

```sql
CREATE TEMP TABLE product_import_staging (
  name TEXT,
  sku TEXT,
  barcode TEXT,
  category TEXT,
  purchase_price NUMERIC(12, 2),
  selling_price NUMERIC(12, 2),
  stock INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 0,
  gst INTEGER DEFAULT 18
);
```

> [!NOTE]
> Creating this as a `TEMP TABLE` ensures that staging data automatically vanishes when your `psql` session ends, preventing production clutter.

---

## 10. Import CSV Into Staging

Execute `\copy` in `psql` to stream the local CSV into the staging table:

```sql
\copy product_import_staging (name, sku, barcode, category, purchase_price, selling_price, stock, minimum_stock, gst) FROM '/path/to/products_import.csv' WITH (FORMAT csv, HEADER true);
```

### Common `\copy` Errors & Fixes
- `ERROR: relation "product_import_staging" does not exist`: Run Section 9 `CREATE TEMP TABLE` statement first.
- `ERROR: could not open file`: Verify the local file path is correct and quoted properly.
- `ERROR: invalid input syntax for integer`: Check CSV for non-numeric stock/GST values or unremoved header text.
- `ERROR: extra data after last expected column`: Check for unquoted commas inside product names (e.g., `Rice, Premium 5kg` must be `"Rice, Premium 5kg"`).

---

## 11. Validate BEFORE Inserting

Run validation queries on `product_import_staging` BEFORE inserting any rows into `products`.

### 1. Count Staging Rows
```sql
SELECT COUNT(*) FROM product_import_staging;
```
*Verify that this count matches your CSV row count.*

### 2. Check for Missing Required Fields
```sql
SELECT * 
FROM product_import_staging 
WHERE name IS NULL OR name = '' 
   OR sku IS NULL OR sku = '' 
   OR purchase_price IS NULL 
   OR selling_price IS NULL;
```
*Expected output: 0 rows.*

### 3. Check for Duplicate SKUs within the CSV
```sql
SELECT sku, COUNT(*) 
FROM product_import_staging 
GROUP BY sku 
HAVING COUNT(*) > 1;
```
*Expected output: 0 rows.*

### 4. Check for Invalid Prices or Negative Stock
```sql
SELECT * 
FROM product_import_staging 
WHERE selling_price < purchase_price 
   OR purchase_price < 0 
   OR selling_price < 0 
   OR stock < 0;
```
*Expected output: 0 rows.*

### 5. Check for Conflicts with Existing Store Inventory
Check if any imported SKUs already exist in the target store:
```sql
SELECT s.sku, s.name AS staging_name, p.name AS existing_name
FROM product_import_staging s
JOIN products p ON LOWER(p.sku) = LOWER(s.sku)
WHERE p.store_id = <STORE_ID>;
```
*If rows are returned, decide whether to skip duplicate SKUs or adjust them before inserting.*

> [!CAUTION]
> **DO NOT CONTINUE IF VALIDATION RETURNS UNEXPECTED RESULTS.** Fix the CSV, truncate `product_import_staging`, and re-import.

---

## 12. Dry-Run / Expected Insert Count

Run a dry-run query to calculate how many new products will be inserted:

```sql
SELECT COUNT(*) AS new_products_to_insert
FROM product_import_staging s
WHERE NOT EXISTS (
  SELECT 1 FROM products p 
  WHERE p.store_id = <STORE_ID> 
    AND LOWER(p.sku) = LOWER(s.sku)
);
```

---

## 13. Insert Into Production Products

Execute the production `INSERT` statement. This query maps staging fields, converts Rupees to Paise, calculates margin and markup, and explicitly assigns `<ORG_ID>` and `<STORE_ID>`.

> [!IMPORTANT]
> **DEFAULT SAFE MODE IS INSERT-ONLY.** Do not use UPSERT (`ON CONFLICT ... UPDATE`) by default, as an incorrect SKU match could inadvertently overwrite existing production products.

```sql
BEGIN;

INSERT INTO products (
  organization_id,
  store_id,
  name,
  sku,
  barcode,
  category,
  purchase_price,       -- Converted to Paise
  selling_price,        -- Converted to Paise
  stock,
  minimum_stock,
  gst,
  is_active,
  margin_percent,
  markup_percent,
  average_cost,         -- Converted to Paise
  last_purchase_cost,   -- Converted to Paise
  reorder_quantity,
  created_at,
  updated_at
)
SELECT
  <ORG_ID> AS organization_id,
  <STORE_ID> AS store_id,
  TRIM(s.name) AS name,
  TRIM(s.sku) AS sku,
  NULLIF(TRIM(s.barcode), '') AS barcode,
  NULLIF(TRIM(s.category), '') AS category,
  ROUND(s.purchase_price * 100)::INTEGER AS purchase_price,
  ROUND(s.selling_price * 100)::INTEGER AS selling_price,
  COALESCE(s.stock, 0) AS stock,
  COALESCE(s.minimum_stock, 0) AS minimum_stock,
  COALESCE(s.gst, 18) AS gst,
  1 AS is_active,
  -- Calculate Margin %: ((Selling - Purchase) / Selling) * 100
  CASE 
    WHEN s.selling_price > 0 THEN ROUND(((s.selling_price - s.purchase_price) / s.selling_price) * 100)::INTEGER
    ELSE 0 
  END AS margin_percent,
  -- Calculate Markup %: ((Selling - Purchase) / Purchase) * 100
  CASE 
    WHEN s.purchase_price > 0 THEN ROUND(((s.selling_price - s.purchase_price) / s.purchase_price) * 100)::INTEGER
    ELSE 0 
  END AS markup_percent,
  ROUND(s.purchase_price * 100)::INTEGER AS average_cost,
  ROUND(s.purchase_price * 100)::INTEGER AS last_purchase_cost,
  CASE 
    WHEN COALESCE(s.minimum_stock, 0) > 0 THEN s.minimum_stock * 2 
    ELSE 10 
  END AS reorder_quantity,
  NOW() AS created_at,
  NOW() AS updated_at
FROM product_import_staging s
WHERE NOT EXISTS (
  SELECT 1 FROM products p 
  WHERE p.store_id = <STORE_ID> 
    AND LOWER(p.sku) = LOWER(s.sku)
);
```

---

## 14. Transaction Safety (Commit vs. Rollback)

Before committing the transaction, run post-insert verification queries (Section 15).

- **If all verification queries pass:**
  ```sql
  COMMIT;
  ```
- **If any error or discrepancy is detected:**
  ```sql
  ROLLBACK;
  ```

---

## 15. Verify Import

Run these checks while still inside the transaction (or immediately after `COMMIT`):

### 1. Check Insert Count for Target Tenant
```sql
SELECT COUNT(*) 
FROM products 
WHERE organization_id = <ORG_ID> 
  AND store_id = <STORE_ID>;
```

### 2. Inspect Recently Imported Products
```sql
SELECT 
  id,
  name,
  sku,
  barcode,
  category,
  purchase_price / 100.0 AS purchase_inr,
  selling_price / 100.0 AS selling_inr,
  stock,
  gst,
  margin_percent,
  organization_id,
  store_id,
  created_at
FROM products
WHERE organization_id = <ORG_ID>
  AND store_id = <STORE_ID>
ORDER BY id DESC
LIMIT 10;
```

### 3. Confirm Zero Tenant Cross-Contamination
Verify that NO newly imported products have null or wrong `organization_id`/`store_id`:
```sql
SELECT COUNT(*) 
FROM products 
WHERE store_id = <STORE_ID> 
  AND (organization_id IS NULL OR organization_id != <ORG_ID>);
```
*Expected output: 0.*

---

## 16. Stock Initialization & Audit History

### Direct Stock Setting
Setting `stock` directly in the `products` table sets opening inventory levels.

> [!CAUTION]
> NEVER run un-scoped global updates like `UPDATE products SET stock = 100;`.

### Optional Audit Tracking in `inventory_movements`
If your organization requires an audit trial for opening stock in the POS reports, insert opening stock logs into `inventory_movements` (`backend/src/db/schema.ts`):

```sql
INSERT INTO inventory_movements (
  organization_id,
  store_id,
  movement_type,
  product_id,
  quantity,
  previous_stock,
  new_stock,
  reference_type,
  reason,
  created_by,
  created_at
)
SELECT
  p.organization_id,
  p.store_id,
  'OPENING_STOCK' AS movement_type,
  p.id AS product_id,
  p.stock AS quantity,
  0 AS previous_stock,
  p.stock AS new_stock,
  'INITIAL_IMPORT' AS reference_type,
  'Bulk CSV opening stock import' AS reason,
  'System Import' AS created_by,
  NOW() AS created_at
FROM products p
WHERE p.organization_id = <ORG_ID>
  AND p.store_id = <STORE_ID>
  AND p.created_at >= NOW() - INTERVAL '10 minutes';
```

---

## 17. Category Behavior

In Orion POS, product categories are stored as text strings in `products.category` (indexed by `idx_products_category`). There is no standalone `categories` table.

### Verify Distinct Categories for Target Store
```sql
SELECT category, COUNT(*) AS product_count
FROM products
WHERE organization_id = <ORG_ID>
  AND store_id = <STORE_ID>
GROUP BY category
ORDER BY product_count DESC;
```

---

## 18. Product Images

- `image_url` is an optional text field in `products`.
- Bulk CSV import should NOT attempt to upload local binary image files directly into PostgreSQL.
- If images are available, upload them to your CDN or storage bucket (Cloudinary / S3) and include the full public HTTPS URL in the CSV `image_url` column (e.g. `https://res.cloudinary.com/.../image.jpg`).

---

## 19. Cleanup

After committing the transaction and completing verification, drop the temporary staging table:

```sql
DROP TABLE IF EXISTS product_import_staging;
```

---

## 20. Emergency Rollback / Recovery After Accidental Import

If an import was mistakenly performed against the WRONG store or organization:

> [!CAUTION]
> **NEVER EXECUTE `DELETE FROM products;` WITHOUT A WHERE CLAUSE.**

### 1. Check for Dependent Records First
Before deleting mistakenly inserted products, verify whether any sales, invoices, or inventory records reference them:

```sql
SELECT 
  (SELECT COUNT(*) FROM sale_items WHERE product_id IN (SELECT id FROM products WHERE store_id = <WRONG_STORE_ID> AND created_at >= '<IMPORT_TIMESTAMP>')) AS sale_item_references,
  (SELECT COUNT(*) FROM inventory_movements WHERE product_id IN (SELECT id FROM products WHERE store_id = <WRONG_STORE_ID> AND created_at >= '<IMPORT_TIMESTAMP>')) AS movement_references;
```

### 2. Safe Targeted Deletion (If No Dependent Records Exist)
If `sale_item_references` is `0`:
```sql
BEGIN;

-- Delete inventory movements created during import if applicable
DELETE FROM inventory_movements 
WHERE store_id = <WRONG_STORE_ID> 
  AND created_at >= '<IMPORT_TIMESTAMP>';

-- Delete imported products for wrong store
DELETE FROM products 
WHERE store_id = <WRONG_STORE_ID> 
  AND created_at >= '<IMPORT_TIMESTAMP>';

-- Verify deletion count, then COMMIT
COMMIT;
```

### 3. Archive via `is_active = 0` (If Dependent Records Exist)
If sales have already occurred against these products, soft-delete them instead:
```sql
UPDATE products 
SET is_active = 0, updated_at = NOW() 
WHERE store_id = <WRONG_STORE_ID> 
  AND created_at >= '<IMPORT_TIMESTAMP>';
```

---

## 21. Common Errors & Troubleshooting

| Error Message | Cause | Resolution |
| :--- | :--- | :--- |
| `relation "product_import_staging" does not exist` | Staging table not created yet in current `psql` session. | Run Section 9 `CREATE TEMP TABLE` statement. |
| `could not open file ...` | Invalid file path or missing quotes in `\copy`. | Check file path on local client machine. |
| `invalid input syntax for integer: "450.00"` | Price loaded into INTEGER field without conversion. | Staging table prices must be `NUMERIC(12,2)`. Conversion to Paise occurs during `INSERT`. |
| `violates foreign key constraint "products_store_id_stores_id_fk"` | `<STORE_ID>` does not exist in `stores` table. | Verify `<STORE_ID>` using queries in Section 3. |
| `violates not-null constraint "products_sku_key"` | Missing SKU value in CSV row. | Ensure all rows have a non-empty `sku`. |
| `Products show 100x expensive price in UI` | Prices inserted in Rupees instead of Paise. | Ensure `INSERT` statement converts Rupees to Paise (`ROUND(price * 100)`). |
| `Products missing from POS interface` | Injected `is_active = 0` or wrong `store_id`. | Confirm `is_active = 1` and `store_id = <STORE_ID>`. |

---

## 22. Final Production Checklist

Before closing the production import task, verify each item:

- [ ] Production database backup confirmed / completed.
- [ ] Target `organization_id` identified and verified.
- [ ] Target `store_id` identified and verified.
- [ ] Verified that `store_id` belongs to `organization_id`.
- [ ] CSV file headers formatted correctly (`name,sku,barcode,category,purchase_price,selling_price,stock,minimum_stock,gst`).
- [ ] Barcode column in Excel set to Text format (no scientific notation).
- [ ] Prices checked for currency symbols or formatting errors.
- [ ] CSV saved as CSV UTF-8.
- [ ] Staging table `product_import_staging` created.
- [ ] CSV imported into staging table via `\copy`.
- [ ] Staging row count verified against CSV.
- [ ] Zero missing product names or SKUs in staging.
- [ ] Zero duplicate SKUs within staging.
- [ ] Zero duplicate SKUs against target store in `products`.
- [ ] Expected insert count confirmed.
- [ ] Transaction started with `BEGIN;`.
- [ ] `INSERT INTO products` executed with `<ORG_ID>` and `<STORE_ID>`.
- [ ] Price conversion to Paise (`* 100`) verified.
- [ ] Sample products inspected (`SELECT ... LIMIT 10`).
- [ ] POS Web UI refreshed and products verified in catalog.
- [ ] Transaction committed with `COMMIT;`.
- [ ] Staging table dropped (`DROP TABLE IF EXISTS product_import_staging;`).

---

## 23. Quick Reference (Developer Cheat-Sheet)

```sql
-- 1. Connect
psql "<DATABASE_URL>"

-- 2. Verify Tenant
SELECT s.id AS store_id, s.name AS store, o.id AS org_id, o.name AS org
FROM stores s JOIN organizations o ON s.organization_id = o.id
WHERE s.id = <STORE_ID> AND o.id = <ORG_ID>;

-- 3. Staging Table
CREATE TEMP TABLE product_import_staging (
  name TEXT, sku TEXT, barcode TEXT, category TEXT,
  purchase_price NUMERIC(12,2), selling_price NUMERIC(12,2),
  stock INTEGER DEFAULT 0, minimum_stock INTEGER DEFAULT 0, gst INTEGER DEFAULT 18
);

-- 4. Copy CSV
\copy product_import_staging (name, sku, barcode, category, purchase_price, selling_price, stock, minimum_stock, gst) FROM '/path/to/products.csv' WITH (FORMAT csv, HEADER true);

-- 5. Validate
SELECT COUNT(*) FROM product_import_staging;
SELECT * FROM product_import_staging WHERE name IS NULL OR sku IS NULL OR selling_price < purchase_price;

-- 6. Insert
BEGIN;
INSERT INTO products (
  organization_id, store_id, name, sku, barcode, category,
  purchase_price, selling_price, stock, minimum_stock, gst, is_active,
  margin_percent, markup_percent, average_cost, last_purchase_cost, reorder_quantity, created_at, updated_at
)
SELECT
  <ORG_ID>, <STORE_ID>, TRIM(s.name), TRIM(s.sku), NULLIF(TRIM(s.barcode), ''), NULLIF(TRIM(s.category), ''),
  ROUND(s.purchase_price * 100)::INTEGER, ROUND(s.selling_price * 100)::INTEGER,
  COALESCE(s.stock, 0), COALESCE(s.minimum_stock, 0), COALESCE(s.gst, 18), 1,
  CASE WHEN s.selling_price > 0 THEN ROUND(((s.selling_price - s.purchase_price) / s.selling_price) * 100)::INTEGER ELSE 0 END,
  CASE WHEN s.purchase_price > 0 THEN ROUND(((s.selling_price - s.purchase_price) / s.purchase_price) * 100)::INTEGER ELSE 0 END,
  ROUND(s.purchase_price * 100)::INTEGER, ROUND(s.purchase_price * 100)::INTEGER,
  CASE WHEN COALESCE(s.minimum_stock, 0) > 0 THEN s.minimum_stock * 2 ELSE 10 END,
  NOW(), NOW()
FROM product_import_staging s
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.store_id = <STORE_ID> AND LOWER(p.sku) = LOWER(s.sku));

-- 7. Verify
SELECT id, name, sku, purchase_price / 100.0 AS purchase_inr, selling_price / 100.0 AS selling_inr, stock 
FROM products WHERE organization_id = <ORG_ID> AND store_id = <STORE_ID> ORDER BY id DESC LIMIT 5;

-- 8. Commit & Clean
COMMIT;
DROP TABLE IF EXISTS product_import_staging;
```
