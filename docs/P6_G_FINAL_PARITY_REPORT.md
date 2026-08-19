# APKA BILL — P6-G FINAL WEB ↔ EXPO PARITY & PRODUCTION REGRESSION REPORT
**Document Version**: 1.0.0 (Production Release Ready)  
**Date**: 2026-08-19  
**Release Status**: **GO**

---

## 1. Executive Summary
The Expo mobile client (`mobile-expo`) has achieved complete feature, architectural, and mathematical parity with the Web/PWA production application across all store/cashier capabilities. Local-first responsiveness, atomic SQLite mutations with WAL mode, background outbox synchronization with exponential backoff, strict multi-store tenant isolation, and ESC/POS thermal printing with AutoReplyPrint have all been rigorously verified.

---

## 2. Web & Expo Feature Inventory

| Module | Web / PWA Status | Expo Mobile Status | SQLite Mode | Sync Status | Offline Mode |
|---|:---:|:---:|:---:|:---:|:---:|
| **Auth & Store Context** | Production | Production | Persisted | Token Refresh | OFFLINE READ |
| **Dashboard & Ledger** | Production | Production | Native Ledger | Delta Sync | OFFLINE FULL |
| **Product Catalog & Search** | Production | Production | Indexed Table | Delta Pull | OFFLINE FULL |
| **Cart & Cashier POS** | Production | Production | Atomic `withTransaction` | Outbox Push | OFFLINE FULL |
| **Customers & Ledger** | Production | Production | Indexed Table | Outbox Push | OFFLINE FULL |
| **Suppliers & Inward** | Production | Production | Indexed Table | Outbox Push | OFFLINE FULL |
| **Procurement Purchases** | Production | Production | Atomic `withTransaction` | Outbox Push | OFFLINE FULL |
| **Store Expenses** | Production | Production | Local Table | Outbox Push | OFFLINE FULL |
| **Stock Adjustments & Audit**| Production | Production | Atomic `inventory_logs` | Outbox Push | OFFLINE FULL |
| **Reports & Profit/Loss** | Production | Production | SQLite Aggregation | Background Pull | OFFLINE FULL |
| **Bills & Invoice History** | Production | Production | Indexed Queries | Delta Pull | OFFLINE FULL |
| **58mm Thermal Printing** | Production | Production | SDK Profile | N/A | OFFLINE FULL |
| **Dynamic UPI QR Code** | Production | Production | Store Settings | N/A | OFFLINE FULL |
| **13-Tab Store Settings** | Production | Production | `store_settings` | Outbox Push | OFFLINE READ/SYNC |
| **CSV / Excel Exports** | Production | Production | File System / Share | N/A | OFFLINE FULL |

---

## 3. Critical Gate Audits

### 3.1 P0 Gate: Multi-Store Isolation
* **Result**: **PASS**
* **Verification**: All queries across `products`, `sales`, `purchases`, `expenses`, `customers`, `suppliers`, `inventory_logs`, and `outbox` strictly filter by `store_id`. Store 1 transactions are completely isolated from Store 2.

### 3.2 P0 Gate: Idempotency & Duplicate Prevention
* **Result**: **PASS**
* **Verification**: Double-taps on checkout or network reconnect retries submit identical `clientMutationId` with `X-Offline-Id` headers. Outbox and server middleware block secondary inserts.

### 3.3 P0 Gate: Financial & Calculation Parity
* **Result**: **PASS**
* **Verification**: $\text{Line Totals} \rightarrow \text{Gross Subtotal} \rightarrow \text{Discounts} \rightarrow \text{GST Taxes} \rightarrow \text{Cash Round-Off} \rightarrow \text{Grand Total}$ produces identical amounts across POS Cart, Invoices, Thermal Receipts, and UPI QR Codes.

### 3.4 P0 Gate: Thermal Receipt & Decoupled Printing
* **Result**: **PASS**
* **Verification**: 2-column layout (Item name & quantity on left, price on right) formats all purchased items without truncation; UPI QR code centers with size 3 and explicit left-align reset. Printer disconnection leaves sale saved in SQLite and allows retry printing without duplicate sales.

---

## 4. Release Status Verdict

```text
============================================================
RELEASE STATUS: GO
============================================================
- 0 P0 Blocker Bugs
- 0 P1 Critical Bugs
- Strict Multi-Store Isolation Verified
- Complete Web <-> Expo Feature Parity Verified
- Offline-First Ledger & Background Sync Verified
- Native Thermal ESC/POS Printing Hardened
============================================================
```
