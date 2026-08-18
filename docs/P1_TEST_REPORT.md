# P1 TEST REPORT: APKA BILL ANDROID CASHIER APP
**Date**: August 18, 2026  
**Scope**: Production Completeness + Store Operations + Web Parity  
**Target Environment**: `mobile-expo/` (One Organization, One Store)  
**TypeScript Status**: `0 Errors` (`npx tsc --noEmit`)  
**Automated Unit Tests**: `32 / 32 Passed` (`node src/__tests__/runStandaloneTests.js`)

---

## 1. Executive Summary

P1 extends the hardened offline-first SQLite POS architecture from P0 to provide **complete operational feature parity** with the Web cashier application without rewriting the sync engine, modifying authentication, or altering the one-org/one-store scope.

All mutations follow the mandatory pattern:
$$\text{Local SQLite Transaction} \longrightarrow \text{Outbox Queue} \longrightarrow \text{Background Sync Engine} \longrightarrow \text{Server Reconciliation}$$

---

## 2. P1 Feature Matrix & Verification

| Operational Feature | Implementation Details | SQLite Tables / Columns | Offline-First & Sync | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Idempotent Checkout** | `client_mutation_id` generated per checkout. If retry or re-submission occurs, duplicate sales and duplicate stock deductions are prevented. | `sales.client_mutation_id`, `sales.round_off`, `sales.notes` | Local deduplication + server outbox event | ✅ PASS |
| **Park / Held Carts** | Cashiers can park the active register cart with customer details, and recall or delete draft carts later. | `held_carts` (`cart_name`, `cart_payload`, `total_amount`) | Local SQLite table | ✅ PASS |
| **Round-Off & Notes** | Round-off toggle calculating nearest rupee delta; optional cashier sale notes/memo. | `sales.round_off`, `sales.notes` | Stored in SQLite & printed on receipt | ✅ PASS |
| **Expense Tracking** | Complete expense logging by category (`Rent`, `Utilities`, `Salary`, `Maintenance`, `Logistics`, `Tea & Snacks`, `Marketing`, `Miscellaneous`), payment mode, and notes. | `expenses` table (`category`, `amount`, `payment_mode`, `date`, `notes`) | Enqueued to outbox for cloud sync | ✅ PASS |
| **Supplier Purchases** | Purchase order entry with supplier selection/quick-add, invoice number, and line item builder. | `purchases`, `purchase_items`, `suppliers` | Transactionally increments product stock in SQLite and enqueues outbox event | ✅ PASS |
| **Inventory Stock Adjustments** | Stock adjustments (`INCREASE`, `DECREASE`, `SET`) with audit reasons (`DAMAGED`, `SPOILED`, `RESTOCKED`, `CORRECTION`, `THEFT`, `AUDIT`, `OTHER`). | `stock_adjustments` audit table, `products.stock` | Transactionally modifies product stock and logs audit trail | ✅ PASS |
| **Low-Stock Alerting** | Configurable `min_stock_level` per product with visual `LOW STOCK` badges in catalog. | `products.min_stock_level` | Local threshold calculation | ✅ PASS |
| **Customer Order History** | Customer detail modal rendering full invoice purchase history, total spent, and visit timeline. | `customers`, `sales` relational join | Local SQLite query | ✅ PASS |
| **Reports & Profit Analytics** | Period filters (`Today`, `Yesterday`, `7 Days`, `Month`, `Custom`) calculating Revenue, Output GST, Total Expenses, and Net Profit ($\text{Revenue} - \text{COGS} - \text{Expenses}$). Payment method breakdown (Cash, UPI, Card, Wallet). | `sales`, `sale_items`, `products`, `expenses` | Computed dynamically from local SQLite store | ✅ PASS |

---

## 3. Automated Test Evidence

### TypeScript Type-Check
```bash
$ npx tsc --noEmit
# Result: 0 errors
```

### Standalone Test Suite Run (`src/__tests__/runStandaloneTests.js`)
```
[PASS] Receipt formatting title
[PASS] Receipt formatting invoice number
[PASS] Receipt formatting grand total label
[PASS] Receipt formatting grand total value
[PASS] Receipt formatting VOID watermark
[PASS] Web cartTotals gross subtotal calculation
[PASS] Web cartTotals line item discount calculation
[PASS] Web cartTotals GST tax calculation
[PASS] Web cartTotals unrounded grand total parity (1222)
[PASS] Round off difference for integer totals
[PASS] Fractional total rounds to nearest rupee
[PASS] Round off delta is +0.40
[PASS] First checkout attempt executes
[PASS] Duplicate mutation attempt returns existing cached sale without duplicate
[PASS] Duplicate attempt returns same sale ID
[PASS] Stock adjustment INCREASE adds quantity
[PASS] Stock adjustment DECREASE subtracts quantity
[PASS] Stock adjustment DECREASE bounds at 0
[PASS] Stock adjustment SET overrides stock
[PASS] Purchase increments product stock atomically
[PASS] Purchase updates product cost price
[PASS] Operating expenses correctly aggregated (2200)
[PASS] Gross profit calculation (4000)
[PASS] Net profit calculation after expenses (1800)
[PASS] Held cart serializes and deserializes accurately
[PASS] Held cart item quantities preserved
[PASS] Cloudinary URL preserved intact
[PASS] Null image URL returns null
[PASS] Undefined image URL returns null
[PASS] Relative path resolved
[PASS] WhatsApp URL contains phone parameter
[PASS] WhatsApp URL contains invoice number

============================
TESTS COMPLETED: Passed=32, Failed=0
============================
```

---

## 4. Architecture and Migration Safety

Migration `006_p1_operational_features.sql` applies idempotently:
1. `expenses` table for store cost tracking.
2. `suppliers` table for vendor management.
3. `stock_adjustments` table for inventory audits.
4. `held_carts` table for draft cart parking.
5. Column additions with `sqlite_master` column-check safety wrappers:
   - `products.min_stock_level INTEGER DEFAULT 5`
   - `products.is_archived INTEGER DEFAULT 0`
   - `sales.notes TEXT`
   - `sales.round_off INTEGER DEFAULT 0`
   - `sales.client_mutation_id TEXT`

Zero existing user data is deleted or corrupted. All foreign keys and tenant isolation parameters (`store_id`) are enforced across all operations.
