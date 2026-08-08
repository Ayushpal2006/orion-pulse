# GOOGLE SPREADSHEET AUTOMATIC PROVISIONING & REPAIR REPORT (Phase 3)

## Executive Summary

This report documents the implementation of **Phase 3 (Automatic Spreadsheet Provisioning & Repair Engine)** for the Apka Bill / Orion POS multi-tenant SaaS platform.

When a tenant connects or selects a Google Spreadsheet (or when background synchronization runs), Apka Bill automatically verifies and provisions all 8 required worksheets (`Sales`, `Products`, `Customers`, `Purchases`, `Suppliers`, `Inventory`, `Expenses`, `Reports`) and formats their exact column headers without manual user intervention, without overwriting existing data, and without duplicating header rows.

---

## 1. Worksheets & Header Definitions

| Worksheet Title | Exact Column Headers |
|---|---|
| **Sales** | `Invoice Number`, `Date`, `Time`, `Customer Name`, `Customer Phone`, `Payment Method`, `Subtotal`, `Discount`, `GST`, `Grand Total`, `Store`, `Organization`, `Created At` |
| **Products** | `SKU`, `Barcode`, `Product Name`, `Category`, `Purchase Price`, `Selling Price`, `GST`, `Stock`, `Minimum Stock`, `Status`, `Store`, `Organization`, `Created At` |
| **Customers** | `Customer Name`, `Phone`, `Email`, `Address`, `Total Orders`, `Total Spend`, `Store`, `Organization`, `Created At` |
| **Purchases** | `Purchase Number`, `Supplier`, `Date`, `Items`, `Amount`, `Store`, `Organization` |
| **Suppliers** | `Supplier Name`, `Phone`, `Email`, `GST`, `Address`, `Store`, `Organization` |
| **Inventory** | `SKU`, `Product Name`, `Opening Stock`, `Current Stock`, `Minimum Stock`, `Store`, `Organization` |
| **Expenses** | `Expense`, `Category`, `Amount`, `Payment Method`, `Date`, `Store`, `Organization` |
| **Reports** | `Report Type`, `Generated At`, `Store`, `Organization` |

---

## 2. Automatic Provisioning & Repair Architecture

```
[Spreadsheet Selection or Sync Execution]
                   │
                   ▼
       GoogleProvisioningService
  (Independent Service Layer)
                   │
   ┌───────────────┴───────────────┐
   ▼                               ▼
1. Worksheet Check              2. Header Idempotency Check
   (batchUpdate: addSheet)         (values.get A1:Z1 -> values.update)
```

### Key Logic Rules

1. **Worksheet Creation (`addSheet`)**:
   - Queries metadata of existing worksheets via Google Sheets API (`spreadsheets.get`).
   - If a required worksheet exists: **Untouched** (never deleted, never recreated, never overwrites existing data rows).
   - If missing: Executes `batchUpdate` with `addSheet` to dynamically create the missing tab.

2. **Header Validation & Insertion**:
   - For each worksheet, checks if the first row (`A1:Z1`) contains headers.
   - If first row already contains headers: **Untouched** (prevents duplicate header rows).
   - If first row is empty: Inserts predefined headers via `spreadsheets.values.update`.

3. **Self-Healing Repair**:
   - If a user manually deletes a worksheet in Google Drive, the next spreadsheet selection or sync execution automatically recreates the missing tab and header row without crashing checkout or queue execution.

---

## 3. Files Changed

| Component | File Path | Description |
|---|---|---|
| Provisioning Service | `backend/src/services/google-provisioning.service.ts` | Created `GoogleProvisioningService` with `provisionSpreadsheet` and `ensureWorksheetAndHeaders` methods. |
| API Routes | `backend/src/routes/google.routes.ts` | Integrated `GoogleProvisioningService.provisionSpreadsheet` into `POST /api/google/spreadsheet` and `POST /api/google/select-spreadsheet`. |
| Sync Engine | `backend/src/services/sync.service.ts` | Updated `ensureTabs` to delegate pre-sync structure checks to `GoogleProvisioningService.provisionSpreadsheet`. |
| Unit & Integration Tests | `backend/src/tests/test-google-provisioning.ts` | Created 38-step automated test suite covering fresh provisioning, idempotency, self-healing repair, and error handling. |

---

## 4. Multi-Tenant Security & Error Handling

- **Session Scoped**: Provisioning operates strictly on the spreadsheet ID bound to the authenticated `organization_id`.
- **Graceful Error Handling**:
  - `404 / Spreadsheet Not Found`: Logs error safely and notifies tenant to reconnect Google account.
  - `403 / Permission Denied`: Captures error safely without crashing server or checkout process.

---

## 5. Automated Tests Executed

Executed test suite: `backend/src/tests/test-google-provisioning.ts`

```
==================================================
🧪 GOOGLE SPREADSHEET PROVISIONING & REPAIR TEST SUITE
==================================================

--- TEST GROUP 1: Fresh Empty Spreadsheet Provisioning ---
✅ All 8 required worksheets created
✅ All 8 required worksheet headers inserted

--- TEST GROUP 2: Idempotency & Data Safety ---
✅ Existing headers and data rows left untouched
✅ Zero duplicate worksheets or headers created

--- TEST GROUP 3: Automatic Self-Healing Repair ---
✅ Simulated deletion of 'Inventory' worksheet
✅ Missing 'Inventory' worksheet automatically recreated
✅ Missing 'Inventory' headers automatically re-inserted

--- TEST GROUP 4: Error Handling & Permission Safeguards ---
✅ Handles inaccessible spreadsheet gracefully with clear error message

==================================================
🎉 ALL 38/38 PHASE 3 TESTS PASSED SUCCESSFULLY!
==================================================
```

---

## 6. Remaining Work Before Phase 4

Before starting Phase 4 (Real-time & Background Data Synchronization):

1. **Phase 4 Engine Tasks**:
   - Row transformation and payload mapping for transactions (`sale`, `product`, `customer`, `purchase`, `supplier`, `inventory`, `expense`, `report`).
   - Duplicate prevention & upsert logic matching unique record keys (e.g. `Invoice Number`, `SKU`, `Phone`).
   - Background retry manager for rate limits or temporary network outages.
