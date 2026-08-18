# MOBILE DATA & SYNC ARCHITECTURE AUDIT — APKA BILL MOBILE

> **Document Status**: PRODUCTION SYNC & DATA AUDIT MATRIX  
> **Workspace**: `/orion-pulse-main-fresh/docs/MOBILE_SYNC_AUDIT.md`  
> **Target Application**: `mobile-expo/`  
> **Rule**: DO NOT GUESS ENDPOINTS. All mapping is verified against backend Express routes & PostgreSQL schema.

---

## 1. Entity Synchronization & Data Architecture Audit

| Entity | API Endpoint | Request Headers / Params | Server Response Format | Local SQLite Table | Local Primary Key | Org / Store Scope | Pull Strategy | Push Strategy | Current Status & Root Cause |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Products** | `GET /api/sync/download`<br>`GET /api/products` | `Authorization`, `X-Store-Id`, `X-Organization-Id`<br>`?lastSyncTime=<ISO>` | `{ success: true, data: { products: [...] } }` | `products` | `id` (Local AUTOINCREMENT)<br>`server_id` (UNIQUE) | `store_id`, `organization_id` | Delta pull on app launch / background sync -> `ProductRepository.insertBatch()` | Outbox `CREATE` / `UPDATE` -> `POST /api/products` | ⚠️ Partially Synced (Delta pull working, needs full initial fetch on empty DB) |
| **Customers** | `GET /api/sync/download`<br>`GET /api/customers` | `Authorization`, `X-Store-Id`, `X-Organization-Id`<br>`?lastSyncTime=<ISO>` | `{ success: true, data: { customers: [...] } }` | `customers` | `id` (Local AUTOINCREMENT)<br>`server_id` (UNIQUE) | `store_id`, `organization_id` | Delta pull on app launch / background sync -> `CustomerRepository.upsert()` | Outbox `CREATE` -> Batch `POST /api/sync/upload` (`customers: [...]`) | ⚠️ Partially Synced (Working for local, needs complete pull sync) |
| **Sales / Invoices** | `GET /api/sales`<br>`POST /api/sync/upload` | `Authorization`, `X-Store-Id`, `X-Organization-Id`, `X-Offline-Id` | `{ success: true, data: [...] }`<br>`Upload: { sales: [...] }` | `sales`<br>`sale_items` | `id` (Local AUTOINCREMENT)<br>`local_id` (UNIQUE)<br>`server_id` | `store_id`, `organization_id` | Pull server sales -> `SaleRepository.insertServerSalesBatch()` | Outbox batch push -> `POST /api/sync/upload` with header `X-Offline-Id` | ⚠️ Push Working (Needs pull worker for server-created sales) |
| **Purchases & POs** | `GET /api/purchases`<br>`POST /api/purchases` | `Authorization`, `X-Store-Id`, `X-Organization-Id` | `{ success: true, data: [...] }` | `purchases`<br>`purchase_items` | `id` (Local AUTOINCREMENT)<br>`server_id` (UNIQUE) | `store_id`, `organization_id` | Initial pull on launch -> `PurchaseRepository.insertBatch()` | Outbox `CREATE` -> `POST /api/purchases` | ❌ Showing "No purchase records found" (Missing SQLite `purchases` tables & sync worker) |
| **Store Settings** | `GET /api/sync/download`<br>`PUT /api/settings` | `Authorization`, `X-Store-Id`, `X-Organization-Id` | `{ success: true, data: { settings: [...] } }` | `store_settings` | `key` (Scoped: `store_{storeId}_{key}`) | `store_id`, `organization_id` | Pull on app launch -> `SettingsRepository.saveAllSettings(storeId)` | Save to local SQLite -> `PUT /api/settings` | ⚠️ Missing store isolation (Keys were global without `store_id` scope) |
| **Inventory Movements**| `POST /api/sync/upload`<br>`POST /api/inventory/adjustment` | `Authorization`, `X-Store-Id`, `X-Organization-Id` | `Upload: { adjustments: [...] }` | `products`<br>`outbox` | `id` (Product ID) | `store_id`, `organization_id` | Immediate local stock update -> Delta pull reconciles | Outbox batch push -> `POST /api/sync/upload` (`adjustments: [...]`) | ✅ Working offline & in batch upload |
| **Sync Checkpoints** | `GET /api/sync/download` | `?lastSyncTime=<ISO>` | `{ syncTime: "<ISO>" }` | `sync_metadata` | `domain` (PRIMARY KEY) | `store_id`, `organization_id` | Track domain `last_pull_at`, `last_success_at`, `last_error`, `pending_count` | Updated on pull completion | ⚠️ Misleading (UI displayed "Synced" without metadata validation) |

---

## 2. Root Cause Analysis & Truthful Sync Fix Roadmap

### Root Cause 1: Misleading "Synced" Status Badge
* **Current Behavior**: UI renders `✓ Synced` whenever sync worker is idle, even if outbox has pending records or delta pull failed.
* **Truthful Requirement**: Badge MUST display `SYNCED` **ONLY** when:
  1. Valid authentication session exists.
  2. `organization_id` & `store_id` context is resolved.
  3. `pendingCount === 0`.
  4. Delta pull completed successfully without error.
  5. `last_success_at` timestamp is recorded.

### Root Cause 2: Missing Purchases Sync & Tables
* **Current Behavior**: Purchases screen displays "No purchase records found".
* **Fix**: Create SQLite tables `purchases` and `purchase_items`. Add `PurchaseRepository.insertBatch()` and pull `GET /api/purchases` on initial sync.

### Root Cause 3: Sales History Server Pull
* **Current Behavior**: Mobile creates offline sales and uploads to server, but sales created on Web do not pull into mobile SQLite sales history.
* **Fix**: Add sales pull worker fetching `GET /api/sales?limit=50` and inserting header + items into SQLite `sales` and `sale_items`.

### Root Cause 4: Persistent Cart State
* **Current Behavior**: Navigating between screens or switching tabs resets local cart state.
* **Fix**: Move Cart state into persistent local state / context (`CartContext` or `useCartState`) surviving tab switches and component remounts.
