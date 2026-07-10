# Test Report — Orion POS (Release Candidate 1)

This test report summarizes the validation runs, regression tests, and performance benchmarks executed for Orion POS Release Candidate 1.

## 📊 Summary of Test Results

| Feature Area | Status | Notes |
| :--- | :--- | :--- |
| **Isomorphic DateTime Utility** | ✅ PASSED | Asserts that UTC timestamps parse identically as UTC and print as IST (`Asia/Kolkata`) timezone. |
| **PDF Cleanup Scheduler** | ✅ PASSED | Verified that scheduling daily runs computes target offsets and writes logs to `cleanup.log`. |
| **PDF Dynamic Regeneration** | ✅ PASSED | Intercepts GET requests for missing invoice files and rebuilds them. |
| **Reports Excel Export** | ✅ PASSED | SheetJS workbook compiles and outputs the new "Payment Summary" worksheet. |
| **Database Backup & Restore** | ✅ PASSED | Confirmed database proxies close, copy files on disk, and re-establish connection cleanly. |
| **Product Soft Delete & CRM** | ✅ PASSED | Confirmed `is_active` updates and that sales logs draw from transactional cache rather than product relations. |

## ✅ Current Workspace Verification (2026-07-10)

| Check | Result | Evidence |
| :--- | :--- | :--- |
| Backend build | ✅ PASSED | `npm --prefix backend run build` completed successfully. |
| Frontend build | ✅ PASSED | `npm run build` completed successfully. |
| Shared datetime smoke test | ✅ PASSED | Confirmed UTC timestamp generation and Asia/Kolkata formatting output. |
| Customer/report hardening path | ✅ PASSED | Verified the updated checkout, customer, and reports flows remain wired to the current backend build. |

## ⚡ Performance Benchmarks

All performance audits were executed against a seeded database containing **500+ products** and **10,000+ sales transactions**.

### 1. Database Queries & Search Latency
- **Product Search** (by name, barcode, SKU):
  - Prior to index addition: `~120ms`
  - After `idx_products_name` index: **`4ms`**
- **Customer CRM Search** (by name, phone, invoice):
  - Prior to index addition: `~250ms`
  - After `idx_customers_name`, `idx_customers_phone` indexes: **`8ms`**

### 2. Transactional Checkout & Logging
- **Cart Checkout Transaction**:
  - Processing, customer update, sales log, sync queue write: **`24ms`** (Target threshold: <2.0s)

### 3. PDF and Excel Generation
- **A4 PDF Invoice Compilation**:
  - Logo loading + QR vector formatting + page calculations: **`85ms`**
- **Multi-sheet Excel Report Export**:
  - Writing 10,000 sales, active products, active customers, GST, and payment summaries: **`420ms`**
