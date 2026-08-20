# Apka Bill — Tenant Architecture & Data Isolation Audit (Phase 1A)

**Status**: AUDIT COMPLETE (Zero Code / Schema / API Modifications)  
**Date**: 2026-08-20  
**Scope**: Full Stack Tenant Architecture (PostgreSQL Schema, Backend Middleware, Repositories, Services, Controllers, Web/PWA, and Mobile Expo Client)

---

## 1. Authentication & Tenant Identity Flow

### Current Propagation Pipeline
```
[Client (Web / Mobile Expo)]
       │
       │ HTTP Request (Headers: Authorization: Bearer <JWT>, X-Store-Id, X-Organization-Id)
       ▼
[auth.middleware.ts: authenticate()]
       │
       ├─► 1. Verify JWT Signature using env.JWT_SECRET
       │      Payload: { id, email, role, organization_id, store_id, name }
       │
       ├─► 2. Resolve Effective Organization ID:
       │      • Normal Users: organization_id is IMMUTABLE (strictly from decoded JWT).
       │        Any mismatched `X-Organization-Id` header is rejected with 403 Forbidden.
       │      • Super Admin: Can scope via `X-Organization-Id` header.
       │
       ├─► 3. Resolve & Validate Effective Store ID:
       │      • If `X-Store-Id` provided: Verifies against database `stores` table:
       │        `SELECT id, status FROM stores WHERE id = :storeId AND organization_id = :effectiveOrgId`
       │        (Rejects cross-org store tampering with 403 Forbidden).
       │      • If no header: Fallback to token's store_id or organization's primary default store.
       │
       ├─► 4. Attach Identity to Request:
       │      `req.user = { id, email, role, organization_id, store_id, name }`
       │
       └─► 5. Initialize AsyncLocalStorage Context:
              `storeStorage.run({ organizationId, currentStoreId, userId, role }, next)`
                     │
                     ▼
[Controllers & Services]
       │
       ├─► Calls `getTenantContext()` / `getOrganizationId()` / `getStoreId()` from `db/context.ts`
       │
       ▼
[Repositories & Database Queries]
       │
       └─► Executes Drizzle ORM SQL queries against PostgreSQL
```

---

## 2. Database Tenant Map

Comprehensive analysis of all 31 tables in `backend/src/db/schema.ts`:

| # | Table Name | Primary Key | `organization_id` Exists | `store_id` Exists | Tenant Relationship | Foreign Keys | Current Isolation Mechanism |
|---|---|---|---|---|---|---|---|
| 1 | `organizations` | `id` | NO (Is Root Tenant) | NO | Root Tenant | None | Slug unique index, primary key |
| 2 | `stores` | `id` | **YES** | NO | Store belongs to Organization | `organization_id -> organizations.id` | Scoped by `organization_id` |
| 3 | `users` | `id` | **YES** | **YES** | User belongs to Org & primary Store | `org_id -> organizations.id`, `store_id -> stores.id` | Filtered by `organization_id` |
| 4 | `user_store_access` | `id` | NO | **YES** | User store permissions | `user_id -> users.id`, `store_id -> stores.id` | Scoped via `user_id` |
| 5 | `products` | `id` | **YES** | **YES** | Product scoped to Store & Org | `org_id -> organizations.id`, `store_id -> stores.id` | Composite index `(store_id, sku)`, filtered by `(org_id, store_id)` |
| 6 | `customers` | `id` | **YES** | **YES** | Customer scoped to Store & Org | `org_id -> organizations.id`, `store_id -> stores.id` | Composite index `(store_id, phone)`, filtered by `(org_id, store_id)` |
| 7 | `sales` | `id` | **YES** | **YES** | Sale invoice scoped to Store & Org | `org_id -> organizations.id`, `store_id -> stores.id`, `customer_id -> customers.id` | Filtered by `(org_id, store_id)` in repo; some service lookups query by raw `id` |
| 8 | `sale_items` | `id` | **YES** | **YES** | Items belonging to Sale | `sale_id -> sales.id`, `product_id -> products.id` | Foreign key to `sales.id` (cascading) |
| 9 | `returns` | `id` | **YES** | **YES** | Return invoice scoped to Store & Org | `org_id -> organizations.id`, `store_id -> stores.id`, `original_sale_id -> sales.id` | Filtered by `store_id` |
| 10 | `return_items` | `id` | **YES** | **YES** | Return line items | `return_id -> returns.id`, `product_id -> products.id` | Foreign key to `returns.id` |
| 11 | `inventory_logs` | `id` | **YES** | **YES** | Historical stock adjustments | `org_id -> organizations.id`, `store_id -> stores.id`, `product_id -> products.id` | Filtered by `store_id` / `product_id` |
| 12 | `inventory_movements` | `id` | **YES** | **YES** | Strict audit movement log | `org_id -> organizations.id`, `store_id -> stores.id`, `product_id -> products.id` | Filtered by `store_id` / `product_id` |
| 13 | `inventory_adjustments`| `id` | **YES** | **YES** | Manual stock adjustments | `org_id -> organizations.id`, `store_id -> stores.id`, `product_id -> products.id` | Filtered by `store_id` |
| 14 | `suppliers` | `id` | **YES** | **YES** | Supplier scoped to Store & Org | `org_id -> organizations.id`, `store_id -> stores.id` | Filtered by `(org_id, store_id)` |
| 15 | `purchase_orders` | `id` | **YES** | **YES** | Purchase orders to Suppliers | `org_id -> organizations.id`, `store_id -> stores.id`, `supplier_id -> suppliers.id` | Filtered by `(org_id, store_id)` |
| 16 | `purchase_items` | `id` | **YES** | **YES** | Purchase line items | `purchase_order_id -> purchase_orders.id`, `product_id -> products.id` | Foreign key to `purchase_orders.id` |
| 17 | `supplier_payments` | `id` | **YES** | **YES** | Payment to Supplier | `org_id -> organizations.id`, `store_id -> stores.id`, `supplier_id -> suppliers.id` | Filtered by `(org_id, store_id)` |
| 18 | `supplier_ledger` | `id` | **YES** | **YES** | Running supplier balance | `org_id -> organizations.id`, `store_id -> stores.id`, `supplier_id -> suppliers.id` | Filtered by `store_id` / `supplier_id` |
| 19 | `expense_categories` | `id` | **YES** | **YES** | Expense categories | `org_id -> organizations.id`, `store_id -> stores.id` | Filtered by `(org_id, store_id)` |
| 20 | `expenses` | `id` | **YES** | **YES** | Store expense records | `org_id -> organizations.id`, `store_id -> stores.id`, `category_id -> expense_categories.id` | Filtered by `(org_id, store_id)` |
| 21 | `settings` | `(store_id, key)`| **NO** | **YES** | Key-value settings per store | `store_id -> stores.id` | Filtered by `store_id` (relies on Store ownership) |
| 22 | `google_integrations`| `id` | **YES** | **YES** | Google Sheets sync credentials | `organization_id -> organizations.id`, `store_id -> stores.id` | Filtered by `(org_id, store_id)` |
| 23 | `sync_jobs` | `id` | **YES** | **YES** | Offline sync job queue | `organization_id -> organizations.id`, `store_id -> stores.id` | Filtered by `store_id` |
| 24 | `sync_history` | `id` | **YES** | **YES** | Historical sync executions | `org_id -> organizations.id`, `store_id -> stores.id` | Filtered by `store_id` |
| 25 | `device_settings` | `id` | **YES** | **YES** | Hardware / printer profiles | `org_id -> organizations.id`, `store_id -> stores.id` | Unique `device_id`, filtered by `store_id` |
| 26 | `backup_history` | `id` | **YES** | **YES** | Database backup metadata | `org_id -> organizations.id`, `store_id -> stores.id` | Filtered by `store_id` |
| 27 | `audit_logs` | `id` | **YES** | **YES** | System security audit trail | `org_id -> organizations.id`, `store_id -> stores.id`, `user_id -> users.id` | Filtered by `store_id` |
| 28 | `organization_invitations`| `id` | **YES** | NO | Pending user invitations | `organization_id -> organizations.id` | Filtered by `organization_id` & token |
| 29 | `api_keys` | `id` | **YES** | **YES** | External API credentials | `org_id -> organizations.id`, `store_id -> stores.id` | Filtered by `organization_id` |
| 30 | `support_tickets` | `id` | **YES** | **YES** | Customer support tickets | `org_id -> organizations.id`, `store_id -> stores.id` | Filtered by `(org_id, store_id)` |
| 31 | `product_cost_history`| `id` | **YES** | **YES** | Weighted avg cost audit | `org_id -> organizations.id`, `store_id -> stores.id`, `product_id -> products.id` | Filtered by `store_id` / `product_id` |

---

## 3. Module Audit

### 3.1 Products
- **Repository**: `PostgresProductRepository`
  - `getAll()`, `getById()`, `getBySku()`, `getByBarcode()`: **PASS** (Strictly filtered by `and(eq(products.organization_id, orgId), eq(products.store_id, storeId))`).
  - `create()`, `update()`, `delete()`: **PASS** (Values bound to `organizationId` and `currentStoreId`).

### 3.2 Customers
- **Repository**: `PostgresCustomerRepository`
  - `getAll()`, `getById()`, `getByPhone()`: **PASS** (Strictly filtered by `organization_id` and `store_id`).
  - `create()`, `update()`: **PASS** (Enforces tenant boundaries).
- **Service Risk**: In `checkout.service.ts` (line 172), updating customer name on match queries `where(eq(customers.id, customer.id))` without re-asserting tenant condition.

### 3.3 Sales / Billing
- **Repository**: `PostgresSaleRepository`
  - `getAll()`, `getById()`, `getByInvoice()`, `getTodaySales()`: **PASS** (Strictly filtered by `organization_id` and `store_id`).
  - `getItems(saleId)`: **MEDIUM RISK** (Filtered only by `sale_items.sale_id = saleId`, relying on parent sale foreign key).
- **Service Risks**:
  - `SalesService.voidInvoice(saleId)`: **CRITICAL RISK** (`SELECT * FROM sales WHERE id = saleId FOR UPDATE` does not filter by `organization_id` or `store_id`).
  - `SalesService.editInvoice(saleId)`: **CRITICAL RISK** (`SELECT * FROM sales WHERE id = saleId FOR UPDATE` does not filter by `organization_id` or `store_id`).
  - `audit_logs` insertion in `sales.service.ts`: **HIGH RISK** (Inserts `store_id` but leaves `organization_id` null).

### 3.4 Inventory
- **Service**: `InventoryMovementService`
  - `recordMovement()`, `recordAdjustment()`: **PASS** (Inserts `store_id` and checks product ownership).
- **Service**: `ReturnService`
  - `processReturn(saleId)`: **HIGH RISK** (Queries `sales WHERE id = saleId AND store_id = storeId` without `organization_id`, and inserts into `returns`/`return_items` without populating `organization_id`).

### 3.5 Purchases & Suppliers
- **Repository**: `PostgresPurchaseV2Repository`
  - `getAll()`, `getById()`: **PASS** (Filtered by `organization_id` and `store_id`).
  - `getItems(poId)`: **MEDIUM RISK** (Queries `purchase_items WHERE purchase_order_id = poId` without tenant scope).
- **Service**: `PurchaseV2Service`
  - `create()`, `update()`, `voidPurchaseOrder()`: **HIGH RISK** (Inserts into `inventory_movements`, `inventory_logs`, `product_cost_history`, and `supplier_ledger` without setting `organization_id`).

### 3.6 Settings
- **Repository**: `PostgresSettingsRepository`
  - `settings` table has no `organization_id` column. Scoping resolves `store_id` via `stores` lookup against `organization_id`.

### 3.7 Reports & Analytics
- **Repository**: `PostgresReportsRepository` / `AnalyticsService`
  - Aggregate queries in reports repository strictly inject `where(and(eq(sales.organization_id, orgId), eq(sales.store_id, storeId)))`.

### 3.8 Sync (Offline-First & Google Sheets)
- **Routes**: `sync.routes.ts`
  - `/sync/upload`: **PASS** (Enforces `eq(customers.organization_id, orgId)`, `eq(sales.organization_id, orgId)` on delta merge).
  - `/sync/download`: **PASS** (Delta download bounded by `organization_id` and `store_id`).
  - `PostgresSyncRepository`: `getPendingJob` filters by `store_id` but `updateJobStatus` / `recordJobAttempt` query by raw `id` (low risk, internal queue).

---

## 4. Unsafe Query List

| # | File | Function | Current Behavior | Risk | Why It Is Unsafe |
|---|---|---|---|---|---|
| 1 | `backend/src/services/sales.service.ts` | `voidInvoice` | `SELECT * FROM sales WHERE id = :saleId FOR UPDATE` | **CRITICAL** | If a user in Org A passes a valid `saleId` belonging to Org B, the sale is locked and voided, altering Org B's stock and customer metrics. |
| 2 | `backend/src/services/sales.service.ts` | `editInvoice` | `SELECT * FROM sales WHERE id = :saleId FOR UPDATE` | **CRITICAL** | A user in Org A could overwrite invoice items, reverse inventory, and reassign customers of Org B if `saleId` is manipulated. |
| 3 | `backend/src/services/return.service.ts` | `processReturn` | `SELECT * FROM sales WHERE id = :saleId AND store_id = :storeId` | **HIGH** | Queries without `organization_id`. If store IDs collide across organizations (or during multi-tenant store lookups), returns can be processed against another org's sale. |
| 4 | `backend/src/services/purchase.v2.service.ts` | `create`, `update`, `voidPurchaseOrder` | Multiple inserts into `inventory_movements`, `inventory_logs`, `product_cost_history`, `supplier_ledger` | **HIGH** | Inserts populate `store_id` but leave `organization_id` as `NULL`, breaking global tenant audit queries. |
| 5 | `backend/src/services/return.service.ts` | `processReturn` | Inserts into `returns`, `return_items`, `inventory_logs` | **HIGH** | Inserts populate `store_id` but omit `organization_id`. |
| 6 | `backend/src/services/sales.service.ts` | `voidInvoice` | Inserts into `audit_logs` | **HIGH** | Inserts `store_id` and `user_id` but omits `organization_id`. |
| 7 | `backend/src/services/checkout.service.ts` | `checkout` (Line 172) | `UPDATE customers SET name = :name WHERE id = :customerId` | **MEDIUM** | Updates customer by primary key without asserting `organization_id` and `store_id`. |
| 8 | `backend/src/repositories/postgres/sale.repository.ts` | `getItems` | `SELECT ... FROM sale_items WHERE sale_id = :saleId` | **MEDIUM** | Relies entirely on parent `sale_id` foreign key isolation. |
| 9 | `backend/src/repositories/postgres/purchase.v2.repository.ts` | `getItems` | `SELECT ... FROM purchase_items WHERE purchase_order_id = :poId` | **MEDIUM** | Extracts `organizationId` from context but does not apply it to the `WHERE` clause. |
| 10 | `backend/src/services/receipt-builder.service.ts` | `buildReceipt` | Fallback query for public token: `SELECT * FROM sales WHERE public_token = :token` | **LOW** | Intended for unauthenticated public invoice links, but fallback path could be queried without tenant context if token is known. |

---

## 5. API Contract Map (Client-Controlled Identifiers)

| Parameter / Header | Location | Client Controlled? | Backend Verification | Web/PWA Dependency | Expo Sync Dependency |
|---|---|---|---|---|---|
| `X-Organization-Id` | HTTP Header | Yes | **YES**: Normal users cannot tamper (enforced in `auth.middleware.ts`). Super Admin can scope. | Used when switching orgs | Attached via `ApiClient` |
| `X-Store-Id` | HTTP Header | Yes | **YES**: Verified that `stores.organization_id = effectiveOrgId`. | Used when switching active store | Attached via `ApiClient` |
| `req.body.storeId` | HTTP Body | Yes | **PARTIAL**: Repositories use `getTenantContext()` (server source of truth), but some service functions accept raw `storeId`. | Present in some payload schemas | Used in sync outbox payloads |
| `req.params.id` / `saleId` | URL Param | Yes | **VULNERABLE**: In `voidInvoice` and `editInvoice`, raw ID was queried without tenant condition. | Used in sales table action buttons | Used in sale detail screen |

---

## 6. Expo Compatibility Map

The Mobile Expo application (`mobile-expo/`) interacts with the backend through `ApiClient` (`mobile-expo/src/services/api/client.ts`) and SQLite Outbox synchronization (`mobile-expo/src/services/api/sync.service.ts`).

| Backend API Endpoint | Consumed by Expo | Expo Impact of Tenant Hardening | Notes |
|---|---|---|---|
| `POST /api/auth/login` | `auth.service.ts` | **NONE** | Returns user, token, org & store context. |
| `POST /api/sync/upload` | `sync.service.ts` | **NONE** | Uploads offline sales, customers, and adjustments. Server enforces tenant scope. |
| `GET /api/sync/download` | `sync.service.ts` | **NONE** | Downloads delta records bounded by `(org_id, store_id)`. |
| `POST /api/checkout` | `pos.service.ts` | **NONE** | Standard checkout payload with offline idempotency. |
| `GET /api/products` | `product.service.ts` | **NONE** | Returns store-scoped product catalog. |
| `GET /api/customers` | `customer.service.ts` | **NONE** | Returns store-scoped customer list. |
| `GET /api/sales` | `sales.service.ts` | **NONE** | Returns store-scoped invoice list. |
| `POST /api/sales/:id/void` | `sales.service.ts` | **NONE** | Hardening tenant check on `:id` ensures Expo cashiers can only void their own store invoices. |
| `GET /api/settings` | `settings.service.ts` | **NONE** | Reads store-level settings. |

---

## 7. Recommended Phase 1B Implementation Plan (Proposals Only)

1. **Harden Service-Level Primary Key Queries**:
   - In `SalesService.voidInvoice(saleId)`: Change query to `WHERE sales.id = :saleId AND sales.organization_id = :orgId AND sales.store_id = :storeId`.
   - In `SalesService.editInvoice(saleId)`: Change query to `WHERE sales.id = :saleId AND sales.organization_id = :orgId AND sales.store_id = :storeId`.
   - In `ReturnService.processReturn(saleId)`: Add `sales.organization_id = :orgId` to original sale validation.
2. **Populate `organization_id` on All Sub-Table Inserts**:
   - Explicitly provide `organization_id: orgId` on all inserts into `inventory_movements`, `inventory_logs`, `product_cost_history`, `supplier_ledger`, `returns`, `return_items`, and `audit_logs`.
3. **Assert Composite Tenant Scope in Direct Customer Updates**:
   - In `checkout.service.ts` (line 172), update customer with `and(eq(customers.id, customer.id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId))`.
4. **Zero Client Breaking Changes**:
   - Keep all REST endpoint signatures, headers (`X-Store-Id`, `X-Organization-Id`, `Authorization`), and response structures intact for 100% Web/PWA and Expo Android compatibility.
