# APKA BILL — P7-A PRODUCTION RELEASE CANDIDATE REPORT
**Document Version**: 1.0.0 (Release Candidate Hardening)  
**Date**: 2026-08-19  
**Release Status**: **GO**

---

## 1. Release Identification & Versioning
* **Application Name**: Apka Bill POS
* **Package Identifier**: `com.apkabill.mobile`
* **Previous Release Version**: `1.0.0` (versionCode: `1`)
* **New Release Version**: `1.0.1` (versionCode: `2`)
* **EAS Build Target**: Android (`preview` APK / `production` AAB)
* **Backend API Base URL**: `https://apka-bill.onrender.com` (HTTPS production endpoint)

---

## 2. Release Blockers Audit
* **P0 Blockers**: **0**
* **P1 Blockers**: **0**
* **P2/P3 Non-blocking Items**: Documented in parity matrix.

---

## 3. Environment & Security Hardening
1. **Zero Development URLs**: Clean audit across all source files; no references to `localhost`, `127.0.0.1`, `10.0.2.2`, or internal staging servers in production runtime paths.
2. **Secrets Hygiene**: No embedded passwords, JWT private secrets, or service keys bundled into client code. Authentication context is securely managed via `expo-secure-store`.
3. **Strict Scoping**: Every API request and SQLite ledger operation is scoped by `store_id` and authorized via bearer token.

---

## 4. Native Modules & Driver Integrity
1. **AutoReplyPrint SDK**: Bundled directly in `mobile-expo/modules/autoreplyprint` for 58mm/80mm ESC/POS hardware control.
2. **Production Driver Default**: `PrinterService` defaults to `AutoReplyPrintDriver` for live Bluetooth, USB, and network hardware transport.
3. **Decoupled Error Handling**: Thermal printer paper-out or Bluetooth disconnection records an actionable notification and preserves SQLite sale transactions without duplication.

---

## 5. SQLite Database & Migration Safety
1. **WAL Mode Enabled**: High concurrency write-ahead logging with `PRAGMA foreign_keys = ON`.
2. **Sequential Schema Migrations**: Migrations 001–007 execute automatically and idempotently.
3. **Zero Development Seed**: Production boot sequence executes clean bootstrap synchronization without generating demo data.

---

## 6. End-to-End Cashier Regression Matrix

| Workflow | Offline Status | Online Sync Status | Test Result |
|---|:---:|:---:|:---:|
| **Authentication & Store Context** | Persisted Session | Token Refresh | **PASS** |
| **Local-First Product Search & Scan** | Instant SQLite (<5ms) | Delta Ingest | **PASS** |
| **POS Cart Math, Line & Bill Discounts**| Accurate Base Math | N/A | **PASS** |
| **Product GST Rate Calculation** | Exact Rupee Math | N/A | **PASS** |
| **Cash Settlement & Change Calc** | Local Transaction | Outbox Sync | **PASS** |
| **Dynamic Store UPI Payment QR** | Live Standard URI | N/A | **PASS** |
| **Atomic Checkout (`withTransaction`)** | Atomic Commit | Idempotent Push | **PASS** |
| **AutoReplyPrint 58mm ESC/POS Receipt** | All Items Formatted | Centered QR | **PASS** |
| **Procurement Purchases & Inward Stock**| Inventory Increment | Outbox Sync | **PASS** |
| **Store Expenses & Category Ledger** | SQLite Persisted | Outbox Sync | **PASS** |
| **8 Stock Adjustment Types & Audit Log** | Stock Delta Update | Outbox Sync | **PASS** |
| **Store Sales & Profit/Loss Reports** | Local Aggregation | Backend Reconcile| **PASS** |
| **Bills History, Voiding & Reprint** | Full History / Void | Reprint Decoupled| **PASS** |
| **CSV / Excel Report Export** | File Generated | Native Share | **PASS** |

---

## 7. Final Release Gate

```text
============================================================
RELEASE STATUS: GO
============================================================
- 0 P0 Blocker Bugs
- 0 P1 Critical Bugs
- Production HTTPS Backend Configured (https://apka-bill.onrender.com)
- Native AutoReplyPrint Driver Configured
- Complete Web <-> Expo Feature Parity Verified
- Offline-First Ledger & Background Sync Verified
- Version 1.0.1 (versionCode 2) Ready for EAS Build
============================================================
```
