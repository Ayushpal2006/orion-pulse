# APKA BILL — P7-C PRODUCTION MONITORING & OBSERVABILITY
**Document Version**: 1.0.0 (Production Observability Architecture)  
**Date**: 2026-08-19  

---

## 1. Observability Architecture & Design Principles

### 1.1 Non-Blocking & Privacy-Safe Principles
1. **Zero Cashier Interruption**: Telemetry and error reporting run in detached execution branches. If logging or network reporting fails, POS operations (billing, stock updates, printing) proceed 100% unaffected.
2. **Zero PII & Secrets Hygiene**: Passwords, JWT bearer tokens, Authorization headers, customer phone numbers, customer names, and bank details are strictly redacted before ingestion into log buffers.
3. **Bounded In-Memory Ring Buffer**: Diagnostics retain the last 100 events in a rolling ring buffer to guarantee negligible memory and storage overhead.

---

## 2. Error Categorization & Severities

| Error Category | Scope / Subsystem | Example Captured Event |
|---|---|---|
| **`AUTH`** | Login, Token Refresh, Session | `AUTH_TOKEN_EXPIRED`, `AUTH_LOGIN_401` |
| **`API`** | Network REST Client | `API_500_SERVER_ERROR`, `API_TIMEOUT` |
| **`NETWORK`** | Connectivity Transitions | `NETWORK_TRANSITION (ONLINE <-> OFFLINE)` |
| **`DATABASE`** | SQLite / Schema / Queries | `DATABASE_QUERY_ERROR`, `DATABASE_BUSY` |
| **`MIGRATION`** | SQLite Schema Migrations | `MIGRATION_VERSION_MISMATCH` |
| **`SYNC`** | Delta Pull / Mutex / Reconcile | `SYNC_DELTA_PULL_FAILED` |
| **`OUTBOX`** | Outbox Worker / Queue | `OUTBOX_MUTATION_RETRY_EXCEEDED` |
| **`BILLING`** | POS Cart / Checkout / Math | `CHECKOUT_EMPTY_CART_REJECTED` |
| **`PAYMENT`** | Cash / UPI / Card Settlement | `PAYMENT_UNSUPPORTED_MODE` |
| **`PRINTER`** | ESC/POS AutoReplyPrint Driver | `PRINTER_DISCONNECTED`, `PRINT_TIMEOUT` |
| **`UPI`** | UPI ID / QR Payload Generator | `UPI_CONFIG_MISSING` |
| **`IMAGE`** | CDN / Local Image Cache | `IMAGE_RESOLVE_FAILED` |
| **`PERMISSION`**| Bluetooth / Camera / Location | `CAMERA_PERMISSION_DENIED` |

### Severity Scale:
* **`P0`**: Critical blocker (data corruption, duplicate transaction, wrong amount).
* **`P1`**: Workflow blocker (login broken, printer unresponsive, sync permanently failed).
* **`P2`**: Non-critical issue with standard workaround.
* **`P3`**: Informational telemetry / network transition events.

---

## 3. Global Error Boundary & Screen Resilience
* **`ErrorBoundary`**: Root React Error Boundary in `App.tsx` catches unhandled rendering exceptions, records sanitized metadata to `MonitoringService`, and displays a clean recovery view with **Tap to Retry** without exposing raw stack traces to cashier users.

---

## 4. Support Diagnostics Export
* Cashiers and support personnel can generate a complete sanitized diagnostic summary from **Settings $\rightarrow$ Tab 13 (Advanced & System)** $\rightarrow$ **Generate Support Diagnostics Log**.
