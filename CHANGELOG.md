# Changelog - Apka Bill POS

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-08-19 (Apka Bill Mobile Production Release)

### Added
- **Mobile POS & Cashier Parity**: Full offline-first cashier POS in `mobile-expo/` with instant catalog search (<5ms), line +/- quantity, discounts, GST calculation, cash tendered/change, and dynamic store UPI QR generation.
- **58mm / 80mm Native ESC/POS Thermal Printing**: Bundled `AutoReplyPrint` Android SDK with 2-column receipt formatting, centered UPI QR code, and decoupled retry print architecture.
- **Enterprise Offline Sync**: Single-flight mutex lock, atomic SQLite delta pulls, and outbox worker with exponential backoff and `X-Offline-Id` idempotency.
- **Procurement, Expenses & Stock Adjustments**: Atomic purchase inward transactions with stock increments, expense ledgers, and 8 stock adjustment types with audit history.
- **Store Reports & Analytics**: Daily Sales, GST Slabs, and Profit & Loss reports computed locally from SQLite ledgers.
- **Production Observability & Diagnostics**: Added `MonitoringService` and global `ErrorBoundary` with bounded ring buffer and sanitized support diagnostic export.

### Security & Release Hardening
- Added `runtimeVersion: { policy: "appVersion" }` to prevent incompatible OTA updates on native binaries.
- Configured automated preflight validator `scripts/validate-release.mjs`.

### Added
- **SaaS Tenancy Controls**: Created `organizations` and `organization_invitations` modules. Added custom token verification for accept paths.
- **Support Tickets & API Keys**: Added Drizzle tables and Express routers to support external keys integrations and support ticketing.
- **AI Copilot prompt query**: Created `/api/ai/copilot/query` endpoint with smart heuristics answering inventory, sales prediction, and customer CRM prompts.
- **Super Admin Dashboard widgets**: Added `/api/admin/metrics` endpoint reporting database sizes, tenant organizations counts, active users.

### Modified
- **PostgreSQL schema**: Upgraded `src/db/schema.ts` to include Phase 8-10 database schemas.
- **Integration Tests**: Rewrote `backend/src/test-reset.ts` for PostgreSQL compatibility (renamed datetime function to NOW() and cleared inventory logs).
