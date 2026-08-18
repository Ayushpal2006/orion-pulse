# ORION POS / APKA BILL — COMPREHENSIVE MOBILE vs WEB PARITY AUDIT

> **Document Status**: PRODUCTION CORRECTION & FEATURE AUDIT MATRIX  
> **Workspace**: `/orion-pulse-main-fresh/docs/MOBILE_WEB_PARITY_MATRIX.md`  
> **Target Application**: `mobile-expo/`  
> **Product Reference**: Existing Web / PWA Application (`frontend/`)

---

## 1. Web vs Mobile Comprehensive Parity Inventory

| Web Screen | Web Features | API Endpoints | Data Required | Mobile Screen | Mobile Status | Local SQLite Data Required | Offline Support | Sync Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | JWT Auth, login, logout, token refresh, org/store context, session restore | `POST /api/auth/login`<br>`GET /api/auth/me`<br>`POST /api/auth/logout` | `user`, `token`, `organization`, `currentStore` | `LoginScreen.tsx` | ✅ Functional | SecureStore token + cached context | ✅ Offline auth context read | Re-authenticate when token expires (401) |
| **Dashboard** | Sales summary, today orders, revenue, profit, low stock count, recent sales list, top products | `GET /api/dashboard`<br>(Local SQLite math offline) | `todayRevenue`, `todayOrders`, `lowStockCount`, `recentSales` | `DashboardScreen.tsx` | ⚠️ UI needs polishing | `sales`, `sale_items`, `products` | ✅ 100% computed from local SQLite | Background sync updates local tables |
| **POS Billing** | Fast search, product grid, cart, customer selector, tax, discounts, payment methods, invoice creation, parked sales, receipt preview | `POST /api/checkout`<br>`GET /api/sales/invoice/:inv` | `products`, `customers`, `cartItems`, `discount`, `gst` | `BillingScreen.tsx` | ⚠️ Needs touch targets & responsive cart | `products`, `customers`, `sales`, `sale_items`, `outbox` | ✅ Local-first indexed SQLite billing | Enqueue atomic outbox event on checkout |
| **Products Catalog** | List, search, SKU/barcode lookup, add product, edit product, category filter, stock level, image URL, archive/delete | `GET /api/products`<br>`POST /api/products`<br>`PUT /api/products/:id` | `name`, `sku`, `barcode`, `selling_price`, `stock`, `gst` | `ProductsScreen.tsx` | ⚠️ Partial (Add modal works, missing Edit/Archive) | `products` table (`server_id`, `barcode`, `sku`, `stock`) | ✅ Sub-ms indexed SQL search | Bidirectional delta pull (`GET /api/sync/download`) & outbox push |
| **Customer Directory** | Customer list, search by name/phone, add customer, edit customer, purchase history, total spent | `GET /api/customers`<br>`POST /api/customers`<br>`PUT /api/customers/:id` | `name`, `phone`, `email`, `address`, `gstin`, `total_spent` | `CustomersScreen.tsx` | ⚠️ Partial (Add modal works, missing purchase history) | `customers` table (`server_id`, `phone`, `name`) | ✅ Read & write local SQLite | Bidirectional delta pull & outbox push |
| **Sales / Bills History**| Invoice list, search, view invoice details, line items table, reprint receipt, PDF download, refund/cancel | `GET /api/sales`<br>`GET /api/sales/invoice/:inv` | `invoice_number`, `customer_name`, `total_amount`, `items` | `SalesScreen` / `BillingScreen` | ⚠️ Basic (Needs line item details drawer) | `sales`, `sale_items` tables | ✅ Read local SQLite sales & items | Pull server sales & push local outbox sales |
| **Inventory Management**| Stock overview, low stock alerts, stock adjustments (Add/Remove), adjustment reasons, audit log | `POST /api/inventory/adjustment`<br>`GET /api/inventory/logs` | `product_id`, `quantity`, `type`, `reason` | `ProductsScreen.tsx` | ⚠️ Partial (Stock shown, missing adjustment modal) | `products`, `outbox` | ✅ Immediate local stock update | Outbox inventory event push |
| **Purchases & Suppliers**| Supplier list, add/edit supplier, purchase orders, create PO, receive inventory stock, supplier ledger | `GET /api/purchases`<br>`POST /api/purchases`<br>`GET /api/suppliers` | `supplier_id`, `items`, `total_amount`, `status` | `PurchasesScreen.tsx` | ⚠️ Basic list view | `purchases`, `suppliers` | ⚠️ Offline queueing needed | Sync purchase orders & supplier directory |
| **Expenses Tracking** | List expenses, add expense, category dropdown, amount, date, receipt note | `GET /api/expenses`<br>`POST /api/expenses` | `category`, `amount`, `date`, `notes` | `ExpensesScreen` | ❌ Missing on Mobile | `expenses` table | ⚠️ Local SQLite cache | Push expense outbox events |
| **Financial Reports** | Today, Yesterday, Date Range filters, Revenue/Tax breakdown, Category performance, PDF/Excel export | `GET /api/reports`<br>`GET /api/reports/pdf` | `totalRevenue`, `totalOrders`, `taxCollected`, `categories` | `ReportsScreen.tsx` | ⚠️ Added filter pills, needs math check | `sales`, `sale_items` | ✅ 100% computed from local SQLite | Background sync updates sales database |
| **Store Settings** | Store Name, Code, Phone, Email, Address, GSTIN, UPI ID, Receipt Header/Footer, Terms, Branding, Invoice Prefix | `GET /api/settings`<br>`PUT /api/settings` | `storeName`, `phone`, `address`, `gstin`, `receiptFooter` | `SettingsScreen.tsx` | ⚠️ Basic profile, needs tenant isolation | `store_settings` (Scoped by `store_id`) | ✅ Read & write local SQLite settings | Bidirectional Web ↔ Mobile sync |
| **Truthful Sync Engine** | Network status, outbox worker, sync badge, error state, delta pull checkpoint | `POST /api/sync/upload`<br>`GET /api/sync/download` | `outbox`, `lastSyncTime`, `store_id`, `organization_id` | `Header.tsx` / `SyncEngine` | ✅ Rebuilt state machine | `outbox`, `store_settings` | ✅ Offline status tracking | Non-blocking background push & pull |

---

## 2. Production Correction Action Plan

### 1. Truthful Sync Badge & Tenant Isolation Engine
* Scope all SQLite tables and outbox items with `store_id` and `organization_id`.
* `Header.tsx` badge displays `SYNCED` **ONLY** when `pendingCount === 0`, network is online, auth is valid, and zero sync errors exist.

### 2. Production POS Billing & Cart Register
* Touch-friendly product card selection in catalog list.
* Cart quantity increment (`+`) and decrement (`-`) controls, line total calculation (`unitPrice * quantity`), and item deletion (`✕`).
* Editable discount input (₹) with real-time tax (18% GST) and grand total recalculations.
* Customer selector modal with customer search & quick guest info.
* Invoice success modal passing complete `items` array to printer layer.

### 3. Store Settings Parity & Bidirectional Sync
* Full editable form for Store Profile (Name, Address, Phone, Email, GSTIN, UPI ID) and Thermal Printer Driver management.
* Scoped key persistence (`store_{store_id}_{key}`) preventing cross-store setting leakage.
* `PUT /api/settings` integration for Web ↔ Mobile settings synchronization.

### 4. Products, Customers & Inventory Management
* Add Product & Edit Product modals with Name, Barcode/SKU, Price, Stock, Category, GST.
* Add Customer & Edit Customer modals with Name, Phone, Email, Address.
* Stock Adjustment Modal updating SQLite stock immediately offline.

### 5. Sales History & Itemized Receipts
* Full sales list displaying invoice number, date, customer, grand total, and status badge.
* Detailed invoice modal rendering itemized line items table.
