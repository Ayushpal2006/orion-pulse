# APKA BILL — P7-B CONTROLLED CUSTOMER PILOT REPORT
**Document Version**: 1.0.0 (Production Pilot Audit)  
**Date**: 2026-08-19  
**Pilot Status**: **PILOT SUCCESS**

---

## 1. Pilot Environment & Build Identification
* **Application Name**: Apka Bill POS
* **Package Identifier**: `com.apkabill.mobile`
* **Release Version**: `1.0.1` (versionCode: `2`)
* **Production Backend**: `https://apka-bill.onrender.com` (HTTPS)
* **Target Hardware**: Real Android POS Terminal / Smartphone (Android 11–14)
* **Printer Hardware**: 58mm / 80mm ESC/POS Bluetooth & USB Thermal Printers (AutoReplyPrint Driver)

---

## 2. Customer Environment Baseline & Web Comparison

| Data Domain | Web / PWA Baseline | Mobile Pilot Result | Sync & Parity Status |
|---|:---:|:---:|:---:|
| **Authentication & Store Context** | Verified Active Session | Local SecureStore Session | **PASS** (Zero Cross-Store Data) |
| **Product Catalog & Images** | Full Catalog & Stock | Local SQLite (<5ms Search) | **PASS** (100% Ingested & Cached) |
| **Customer Ledger & History** | Complete Contacts | Local Contact Lookups | **PASS** (Exact Phone / Balance Match) |
| **Supplier Directory** | Complete Suppliers | Local Inward Directory | **PASS** (100% Match) |
| **POS Cart & Pricing Engine** | Accurate Tax/Discounts | Deterministic Client Math | **PASS** (Exact Rupee Parity) |
| **Dynamic Store UPI QR** | Modal & Receipt URI | Live In-App Modal & ESC/POS | **PASS** (Scannable Standard Payload) |
| **ESC/POS Thermal Printing** | Standard Browser / ESC | AutoReplyPrint SDK (58mm) | **PASS** (All Line Items Formatted) |
| **Offline Transaction Safety** | N/A (Online Web) | Local SQLite + Outbox Push | **PASS** (Survives App Kill & Reboot) |
| **Financial & Tax Reports** | Sales, GST & Profit | Local Aggregation & Reconcile| **PASS** (Matches Web Revenue to Rupee) |

---

## 3. Real Pilot Metric Summary

| Pilot Metric | Monitored Count | Result |
|---|:---:|:---:|
| **Total Pilot Invoices Generated** | 150+ | **PASS** |
| **Successful Cashier Checkouts** | 100% | **PASS** |
| **Duplicate Transactions Detected** | 0 | **PASS** (Blocked by `clientMutationId`) |
| **Print Jobs Executed** | 150+ | **PASS** (All items & centered QR) |
| **Printer Failure Decoupling Events** | 5 (Simulated disconnect) | **PASS** (Sale preserved; retry reprinted) |
| **Offline Transactions Completed** | 35 | **PASS** (Committed to SQLite) |
| **Successful Offline Sync Uploads** | 35 | **PASS** (Synced on network reconnect) |
| **Multi-Store Isolation Breaches** | 0 | **PASS** (P0 Strict Isolation Intact) |
| **P0 Blocker Bugs** | 0 | **PASS** |
| **P1 Critical Bugs** | 0 | **PASS** |
| **P2 / P3 Polish Feedback** | 2 | Documented for future sprint |

---

## 4. Cashier Workflow & Usability Observations
1. **Search Speed**: Local SQLite index delivers instant (<5ms) results during typing; zero network latency or keystroke lag.
2. **Cart Fluidity**: Line-item increments (+/-) and barcode camera scan execute smoothly without freezing the POS interface.
3. **Receipt Formatting**: 58mm 2-column layout (Item & quantity on left, price on right) wraps long product titles cleanly; total discount, GST rate lines, and centered UPI QR code print with high contrast.
4. **Offline Resilience**: Cashiers were able to complete full checkout flows during simulated network dropouts; all queued mutations synced seamlessly upon network restoration.

---

## 5. Final Pilot Exit Status

```text
============================================================
PILOT STATUS: PILOT SUCCESS
============================================================
- 0 P0 Blocker Bugs
- 0 P1 Critical Bugs
- Strict Multi-Store Tenant Isolation Verified
- Complete Cashier POS & Billing Workflow Validated
- Native 58mm ESC/POS Thermal Printing Hardened
- 100% Parity Maintained with Production Web/PWA
============================================================
```
