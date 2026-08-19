# Apka Bill POS — Release v1.0.1 Notes
**Release Version**: `1.0.1` (Android `versionCode: 2`)  
**Release Date**: 2026-08-19  
**Package Identifier**: `com.apkabill.mobile`  
**Target Backend**: `https://apka-bill.onrender.com` (Production HTTPS)  

---

## 1. Overview
Apka Bill POS v1.0.1 is the official production release of the Android cashier/store application, bringing 100% feature parity with the production Web/PWA application, offline-first SQLite transactionality, background sync with outbox retry, and native 58mm/80mm ESC/POS thermal receipt printing.

---

## 2. Key Release Capabilities

### 2.1 Cashier POS & Billing
* **Instant Product Search**: Real-time indexed lookup across product name, SKU, and camera barcode scan with sub-5ms local queries.
* **Deterministic Pricing & Cart Math**: Accurate line-item quantity adjustments (+/-), line discounts (%), cart-level discounts, product-specific GST rates, cash round-off, and grand totals matching Web down to the rupee.
* **Payment Processing**: Cash settlement with tendered/change calculation, dynamic on-screen & receipt UPI QR generation with standard payment URI payload, Card, Wallet, and Split payment modes.
* **Parked / Held Orders**: Support for pausing active carts and resuming later via local SQLite table `held_carts`.

### 2.2 Native Thermal Printing
* **58mm / 80mm ESC/POS Layout**: 2-column layout (Item name/qty on left, price on right) with clean multiline text wrapping, complete totals, and centered UPI QR code.
* **Decoupled Retry Resilience**: Thermal printer paper-out or Bluetooth disconnect preserves the committed SQLite sale and permits reprinting existing invoices without creating duplicate sales.

### 2.3 Procurement, Expenses & Stock Adjustments
* **Purchase Inward**: Atomic transactions increment inventory stock and update latest cost/selling prices.
* **Store Expenses**: Category-based expense tracking flowing into local Profit & Loss reports.
* **Stock Adjustments**: 8 adjustment types with live before/after previews and audit movement logging.

### 2.4 Offline-First Synchronization & Tenancy
* **Zero-Leak Store Isolation**: Strict tenant scoping across all SQLite queries and mutations (`store_id = 1`).
* **Single-Flight Mutex Sync**: Delta sync engine prevents concurrent duplicate sync runs, advancing the cursor only upon successful SQLite transaction commits.
* **Outbox Retry with Backoff**: Queued offline transactions push to the backend with `X-Offline-Id` idempotency protection.

### 2.5 Observability & Diagnostics
* **React Error Boundary**: Intercepts unhandled UI crashes and provides a clean recovery view.
* **Support Diagnostics Generator**: Sanitized JSON diagnostic report generator in Settings without logging passwords or tokens.

---

## 3. Installation & Support
* **Distribution**: Standalone Android APK (`preview` EAS profile) / Google Play App Bundle (`production` EAS profile).
* **Requirements**: Android 11.0 or newer.
* **Permissions**: Bluetooth, Camera (Barcode scanning), Location (Bluetooth discovery), Internet.
