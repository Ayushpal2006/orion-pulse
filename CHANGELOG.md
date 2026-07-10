# Changelog — Orion POS

All notable changes to the Orion POS codebase are documented here.

## [1.0.0-rc.1] - 2026-07-10

### Added
- **Isomorphic UTC/Kolkata DateTime Standardizer**: Created shared timezone parsing utilities (`src/lib/datetime.ts`, `backend/src/utils/datetime.ts`) to enforce UTC parsing and strict `Asia/Kolkata` time zone display formatting.
- **Dynamic PDF Interception Middleware**: Integrated middleware in `server.ts` to intercept missing PDF receipt requests and dynamically regenerate them from SQLite transaction history on the fly.
- **Vector PDF Layout**: Implemented PDF A4 receipt pages with business logo, offline UPI QR code rendering, and proper page numbers ("Page X of Y").
- **Database Index Optimization**: Added performance indexes (`idx_products_name`, `idx_customers_phone`, `idx_sales_created_at`, etc.) to speed up searches (<200ms) and reports metrics for 10,000+ sales.
- **Database Backup & Restore**: Added REST endpoints for SQLite backup downloads and upload restoration, with safety proxy hot-swapping.
- **Detailed Sync Status UI**: Added connection details, service account copying, job queues, and retry controls in the settings dashboard.

### Changed
- **Payment Summary worksheet**: Added "Payment Summary" tab in Excel reporting export sheet compiling transaction distributions.
- **PDF Daily Storage Cleanup**: Refined scheduler to calculate time zone offsets correctly, run daily at 2:00 AM Kolkata time, and record logs to `cleanup.log`.

### Fixed
- **Historical Invoices**: Fixed invoice receipt views and timelines to load parameters from `sale_items` details rather than soft-deleted `products` schema entries.
- **HTML Invoice QR**: Replaced `[QR]` visual mockup placeholder with actual offline generated QR code inline image tags.

### Verified
- **Current Workspace Validation (2026-07-10)**: Backend TypeScript build completed successfully with `npm --prefix backend run build`.
- **Current Workspace Validation (2026-07-10)**: Frontend production build completed successfully with `npm run build`.
- **Current Workspace Validation (2026-07-10)**: Shared datetime helper smoke test passed for UTC storage and Asia/Kolkata formatting.
