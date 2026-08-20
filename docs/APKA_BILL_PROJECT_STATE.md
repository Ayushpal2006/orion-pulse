# Apka Bill — Production Project State & Architecture Record

## System Overview
- **Product Name**: Apka Bill POS (SaaS Multi-Tenant Billing & Store Operations Engine)
- **Supported Clients**: 
  1. Web / PWA Single Page App (`frontend/`)
  2. Mobile Expo React Native Android App (`mobile-expo/`)
- **Backend Architecture**: Node.js / Express / TypeScript (`backend/`)
- **Database**: PostgreSQL with Drizzle ORM (`backend/src/db/schema.ts`)
- **Offline Strategy**: SQLite Local Read/Write Model (Expo) + Centralized Outbox Sync Queue

---

## Phase 1B — Tenant Isolation Hardening

### Status
**COMPLETE (100% Verified & Tested)**

### Implementation Summary
Applied strict, authoritative tenant isolation across all critical mutation and lookup pathways without altering table schemas, dropping data, or introducing breaking API contract changes.

### Modules Secured
1. **Sales & Billing**:
   - `SalesService.voidInvoice`: Strictly verifies `and(eq(sales.id, saleId), eq(sales.organization_id, orgId), eq(sales.store_id, storeId))` before locking or applying inventory/customer reversals.
   - `SalesService.editInvoice`: Scopes sale lock, item reversals, customer lookup/creation, and audit logging to authenticated `organization_id` and `store_id`.
   - `SalesService.deleteInvoice`: Hardens soft-deletion to ensure only invoices belonging to the caller's store and organization can be deleted.
   - `PostgresSaleRepository.getItems`: Injects composite `(organization_id, store_id)` filtering into line item retrievals.
2. **Returns & Refunds**:
   - `ReturnService.processReturn`: Scopes original sale validation by `organization_id` and `store_id`.
   - Populates `organization_id` across `returns`, `return_items`, and `inventory_logs`.
   - `ReturnService.getReturnsBySaleId`: Filters returns by composite tenant keys.
3. **Purchases & Suppliers**:
   - `PurchaseV2Service.create`: Updates product and supplier balances using `(organization_id, store_id)` constraints and attaches `organization_id` to `inventory_movements`, `inventory_logs`, `product_cost_history`, and `supplier_ledger`.
   - `PurchaseV2Service.update`: Enforces tenant-scoped reversal and application phases.
   - `PurchaseV2Service.voidPurchase`: Scopes PO locking, supplier balance reversal, and ledger audit entries by `organization_id`.
   - `PostgresPurchaseV2Repository.getItems`: Binds `organization_id` and `store_id` to purchase line item queries.
4. **POS Checkout & Customer Scoping**:
   - `CheckoutService.checkout`: Restricts customer name update queries on existing phone matches to `and(eq(customers.id, customer.id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId))`.
5. **Security Audit Logging**:
   - `SalesService.logAudit`: Attaches server-authoritative `organization_id` to all audit log entries.

### Backend Changes
- [`backend/src/services/sales.service.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/services/sales.service.ts): Added authoritative tenant checks and `organization_id` to `voidInvoice`, `editInvoice`, `deleteInvoice`, and `logAudit`.
- [`backend/src/services/return.service.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/services/return.service.ts): Hardened `processReturn` and `getReturnsBySaleId`.
- [`backend/src/services/purchase.v2.service.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/services/purchase.v2.service.ts): Injected `organization_id` into all audit movement, ledger, and cost history inserts across `create`, `update`, and `voidPurchase`.
- [`backend/src/services/checkout.service.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/services/checkout.service.ts): Hardened customer updates during billing.
- [`backend/src/repositories/postgres/sale.repository.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/repositories/postgres/sale.repository.ts): Bound `(organization_id, store_id)` to `getItems`.
- [`backend/src/repositories/postgres/purchase.v2.repository.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/repositories/postgres/purchase.v2.repository.ts): Bound `(organization_id, store_id)` to `getItems`.

### Database Changes
- **Schema Changes**: **NONE**
- **Migration Required**: **NO** (All tables already contain `organization_id` and `store_id` columns; queries were aligned to leverage them).
- **Data Mutated**: **NONE**

### API Changes & Breaking Status
- **Breaking API Changes**: **NONE**
- All endpoint paths (`/api/sales/:id/void`, `/api/sales/:id`, `/api/returns`, `/api/purchases`, `/api/checkout`, `/api/sync/upload`, `/api/sync/download`) retain identical request payloads and response contracts.

---

## Phase 1C — Production Regression Verification

### Status
**COMPLETE**

### Build
**PASS** (`npm run build` backend: 0 errors; `npx tsc --noEmit` frontend: 0 errors)

### Tenant Isolation
**PASS** (100% verified across Customer, Product, Sale, Inventory, Settings, and Sync domains)

### Cross-Organization Tests
**PASS** (Header spoofing, ID lookups, phone lookups, mutations all strictly blocked)

### Cross-Store Tests
**PASS** (Multi-store validation verifies Store 1 / Store 2 data isolation under same or separate organizations)

### Web/PWA Compatibility
**PASS** (All REST endpoints and response structures preserved without deviation)

### Expo API Compatibility
**PASS** (Sync delta download/upload payloads retain exact structure `{ products, customers, settings, syncTime }`)

### Database Changes
**NONE**

### API Changes
**NONE**

### Production Data Modified
**NO** (Only isolated in-memory & test fixture assertions executed)

### Tests Executed
1. `backend/src/tests/test-phase1c-verification.ts` (30 checks passed, 0 failed)
2. `backend/src/tests/test-tenant-isolation-inprocess.ts` (21 checks passed, 0 failed)
3. `npm run build` in `backend/`
4. `npx tsc --noEmit` in `frontend/`

### Known Risks
- Public unauthenticated invoice token endpoint (`GET /invoice/v/:token`) permits access by token design for end-customer WhatsApp sharing.

### Other Client Impact
**NONE** (All client applications operate as designed).

---

## Phase 2A — Modularization Planning

### Status
**COMPLETE**

### Architecture
**Modular Monolith** (Single codebase, single deployment, clean domain module boundaries)

### Code Changes
**Audit/planning only** (Comprehensive audit of 17 functional modules, dependency graph, duplication map, and migration roadmap)

### Database Changes
**NONE**

### API Changes
**NONE**

### Web/PWA Impact
**NONE**

### Expo Impact
**NONE**

### Next Recommended Module
**Expenses Module (`modules/expenses`) in Phase 2B** (Lowest operational risk, zero coupling with active billing, ideal blueprint).

---

## Phase 2B — Expenses Modular Extraction

### Status
**COMPLETE**

### Module
**Expenses (`src/modules/expenses/`)**

### Architecture
**Modular Monolith**

### Implementation
Extracted self-contained expenses domain module comprising types, validation, repository, service, controller, and routes. Fully decoupled direct database queries from HTTP controller layer while strictly maintaining composite `(organization_id, store_id)` tenant isolation.

### Files moved/changed
- [NEW] [`backend/src/modules/expenses/expenses.types.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/modules/expenses/expenses.types.ts)
- [NEW] [`backend/src/modules/expenses/expenses.validation.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/modules/expenses/expenses.validation.ts)
- [NEW] [`backend/src/modules/expenses/expenses.repository.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/modules/expenses/expenses.repository.ts)
- [NEW] [`backend/src/modules/expenses/expenses.service.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/modules/expenses/expenses.service.ts)
- [NEW] [`backend/src/modules/expenses/expenses.controller.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/modules/expenses/expenses.controller.ts)
- [NEW] [`backend/src/modules/expenses/expenses.routes.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/modules/expenses/expenses.routes.ts)
- [NEW] [`backend/src/modules/expenses/index.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/modules/expenses/index.ts)
- [MODIFIED] [`backend/src/routes/expense.routes.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/routes/expense.routes.ts) (delegates to modules/expenses)
- [MODIFIED] [`backend/src/controllers/expense.controller.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/controllers/expense.controller.ts) (re-exports from modules/expenses)
- [NEW] [`backend/src/tests/test-expenses-modular.ts`](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/tests/test-expenses-modular.ts)

### Business Logic Changed
**NO**

### API Changes
**NONE** (Exact paths `/api/expenses`, `/expenses`, `/api/expenses/categories`, `/api/expenses/summary` preserved with identical request/response payloads).

### Database Changes
**NONE**

### Migration Required
**NO**

### Tenant Isolation Preserved
**PASS**

### Web/PWA Impact
**NONE** (Web/PWA expenses UI calls operate with 100% contract compatibility).

### Expo Impact
**NONE**

### Tests
- `backend/src/tests/test-expenses-modular.ts` (16 checks passed, 0 failed)
- `backend/src/tests/test-phase1c-verification.ts` (30 checks passed, 0 failed)
- `npm run build` in `backend/` (PASS)
- `npx tsc --noEmit` in `frontend/` (PASS)

### Known Risks
**NONE**

### Other Client Impact
**NONE**


