# ORION POS / APKA BILL — MOBILE WEB/PWA PARITY MATRIX

> **Document Status**: PRODUCTION AUDIT & PARITY MATRIX  
> **Workspace**: `/orion-pulse-main-fresh/docs/MOBILE_PARITY_MATRIX.md`  
> **Target Mobile Application**: `mobile-expo/`  
> **Product Reference**: Existing Web / PWA Production Application (`frontend/`)

---

## 1. Feature Parity & Gap Audit Matrix

| Feature / Module | Web Status | Mobile Status | API Endpoint(s) | Local SQLite Table | Offline Support | Missing / Broken Functionality |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Session** | ✅ Fully Production Ready (JWT, Bearer token, auto-renewal, logout, `/api/auth/me`) | ⚠️ Partial (Login screen works, token saved in SecureStore) | `POST /api/auth/login`<br>`GET /api/auth/me`<br>`POST /api/auth/logout` | None (SecureStore) | ✅ Read cached session context offline | Session recovery handling on 401 token expiry needed without wiping local DB. |
| **Truthful Sync Indicator** | ✅ Online/Offline status & queue worker | ⚠️ Misleading (Shows "Synced" even when pending outbox exists or pull fails) | `POST /api/sync/upload`<br>`GET /api/sync/download` | `outbox`<br>`store_settings` | ✅ Enqueues outbox events offline | **CRITICAL**: Badge must show `SYNCED` ONLY when pending = 0, latest pull succeeded, and zero errors exist. Otherwise show `PENDING`, `SYNCING`, `OFFLINE`, `FAILED`, or `AUTH_REQUIRED`. |
| **POS Billing Register** | ✅ Full POS (Search, product grid, cart, customer selector, tax, discounts, parked sales, receipt preview) | ⚠️ Partial / Unusable Cart (Product touch selection unoptimized, scrolling issues) | `POST /api/checkout`<br>`GET /api/sales/invoice/:inv` | `products`<br>`customers`<br>`sales`<br>`sale_items` | ✅ Local-first indexed SQLite billing | **CRITICAL**: Cart touch targets, manual quantity adjustment, item removal, discount handling, customer dialog, and responsive scrolling need production hardening. |
| **Products Catalog** | ✅ Full CRUD (Search, category filter, SKU, barcode, add/edit modal, image upload, stock levels) | ⚠️ Partial (Search works, missing Add Product & Edit Product modals) | `GET /api/products`<br>`POST /api/products`<br>`PUT /api/products/:id`<br>`POST /api/products/:id/image` | `products` | ✅ Read & write local SQLite | **MISSING**: Add Product & Edit Product modal dialogs, category filter pills, stock level warning indicators. |
| **Customer Directory** | ✅ Full Directory (Search, add customer, edit customer, phone, purchase history, ledger) | ⚠️ Partial (List works, missing Add/Edit customer modal & purchase history details) | `GET /api/customers`<br>`POST /api/customers`<br>`PUT /api/customers/:id` | `customers` | ✅ Read & write local SQLite | **MISSING**: Add Customer & Edit Customer modal dialogs, lifetime purchase history drawer. |
| **Dashboard Metrics** | ✅ Production Metrics (Today sales, revenue, profit, bill count, top products, low stock alert) | ⚠️ Basic (Metrics calculated from local sales, UI needs Web parity styling) | `GET /api/dashboard`<br>(Calculated locally offline) | `sales`<br>`products` | ✅ Calculated from local SQLite | Dashboard layout cards, low stock alerts list, and recent transaction list formatting need visual alignment. |
| **Store Settings & Profile**| ✅ Full Settings (Store name, code, phone, email, address, GSTIN, UPI ID, logo URL, terms) | ⚠️ Incomplete (Only displays store profile view, missing edit forms & sync) | `GET /api/settings`<br>`PUT /api/settings`<br>`GET /api/super-admin/stores/:id` | `store_settings` | ✅ Local settings persistence | **CRITICAL**: Full Settings Form (General, Store Info, GSTIN, Phone, Address, UPI, Receipt Header/Footer, Terms) with bidirectional Web ↔ Mobile sync. |
| **Receipt & Invoice Design**| ✅ Template Manager (Header, footer text, terms, WhatsApp integration, template selection) | ⚠️ Fixed 58mm ESC/POS layout (Works offline, missing custom text fields in settings) | `GET /api/sales/:id/receipt`<br>`GET /api/sales/:id/pdf` | `store_settings` | ✅ Formatted locally via ReceiptFormatter | Receipt header/footer text & GSTIN should load from local `store_settings` table. |
| **Financial Reports** | ✅ Full Reports (Today, Yesterday, Date Range filters, Revenue/Tax breakdown, PDF/Excel export) | ⚠️ Partial (Basic summary card, missing Date Range picker & PDF/Excel export) | `GET /api/reports`<br>`GET /api/reports/pdf`<br>`GET /api/reports/excel` | `sales` | ✅ Local SQLite report math | Date range filter picker (Today, Yesterday, Last 7 Days, Month to Date), PDF export trigger. |
| **Supplier Management** | ✅ Full Suppliers (List, search, add supplier, edit supplier, supplier ledger) | ⚠️ Partial (Basic list view, missing add/edit supplier dialog) | `GET /api/suppliers`<br>`POST /api/suppliers`<br>`PUT /api/suppliers/:id` | `suppliers` (or API fallback) | ⚠️ API with cache fallback | Add/Edit Supplier modal dialog, phone/GSTIN inputs. |
| **Purchases & Orders** | ✅ Full Purchases (Purchase orders, create PO, receive stock, PO line items, supplier selection) | ⚠️ Partial (Basic list view, missing create PO form) | `GET /api/purchases`<br>`POST /api/purchases` | `purchases` (or API fallback) | ⚠️ API with cache fallback | Create Purchase Order form dialog, supplier dropdown, item addition. |
| **Stock Adjustments** | ✅ Stock Adjustments (Add stock, remove stock, reason logging, inventory audit trail) | ❌ Missing on Mobile | `POST /api/inventory/adjustment`<br>`GET /api/inventory/logs` | `products`<br>`inventory_logs` | ⚠️ Offline queueing needed | Stock Adjustment dialog (Select product, Type: ADD/REMOVE, Quantity, Reason). |
| **Expenses Tracking** | ✅ Expense Tracking (List expenses, add expense, category dropdown, amount, date) | ❌ Missing on Mobile | `GET /api/expenses`<br>`POST /api/expenses` | `expenses` (or API fallback) | ⚠️ API with cache fallback | Expenses Screen tab/view (List, Create Expense form). |

---

## 2. Priority Production Parity Action Plan

### Tier 1 — Critical POS Parity (Billing, Cart & Settings)
1. **Truthful Sync Engine & Badge**: Update `Header.tsx` and `sync.service.ts` so `SYNCED` is displayed ONLY when outbox count = 0, latest pull succeeded, and auth is valid. If sync failed or outbox pending, show `PENDING`, `SYNCING`, `FAILED`, or `AUTH_REQUIRED`.
2. **Production-Ready Billing & Cart UI**: Fix product card touch handlers, cart quantity increments (+/-), manual quantity entry, item removal, discount input, customer picker modal, payment method toggle, and receipt modal.
3. **Full Settings Parity & Bidirectional Sync**: Build complete Store Settings form in `SettingsScreen.tsx` (Store Name, Code, Phone, Email, Address, GSTIN, UPI ID, Receipt Header/Footer, Terms). Save locally to SQLite `store_settings` and sync bidirectionally with Web backend via `PUT /api/settings`.

### Tier 2 — CRUD Dialogs & Inventory Management
4. **Product Management Modals**: Add Product Modal & Edit Product Modal in `ProductsScreen.tsx` with name, SKU, barcode, purchase price, selling price, stock level, GST rate, unit, and category selector.
5. **Customer Management Modals**: Add Customer Modal & Edit Customer Modal in `CustomersScreen.tsx` with name, phone, email, address, and GSTIN.
6. **Stock Adjustment Dialog**: Add Stock Adjustment Modal (Product, Action: ADD/REMOVE, Quantity, Reason) updating local SQLite product stock and enqueueing inventory outbox events.

### Tier 3 — Financial Reports & Supplier Purchases
7. **Reports Enhancements**: Date range filter pills (Today, Yesterday, Last 7 Days, Month to Date) and summary totals calculated from local SQLite sales.
8. **Purchases & Suppliers Modals**: Add Supplier Modal in `PurchasesScreen.tsx` and Create Purchase Order form.
