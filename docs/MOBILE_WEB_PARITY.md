# APKA BILL — MOBILE WEB PARITY AUDIT & EXACT REPLICATION MATRIX
**Project**: `mobile-expo/`  
**Target Environment**: Android Expo Cashier & Store Operations App  
**Source of Truth**: Web Application (`frontend/src/`) & Backend API (`backend/src/`)  
**Brand Identity**: Official Apka Bill (`frontend/public/logo.png`, `icon-512x512.png`)  
**Audit Date**: August 19, 2026 (Phase P2 Completed)  

---

## 1. Executive Parity Audit Matrix

| Web / PWA Feature | Web Route / Component | Mobile Screen / Component | Implementation Status | Technical Parity Details |
| :--- | :--- | :--- | :--- | :--- |
| **Official Branding & Logo** | `AppShell` (`components/app-shell.tsx`) | `Header.tsx`, `DrawerNav.tsx`, `LoginScreen.tsx`, `assets/logo.png` | ✅ **100% Parity** | Exact canonical Apka Bill logo asset (`logo.png`, 512x512 icon) used across App header, login, drawer, splash, and launcher. |
| **Global App Shell & Header** | `AppShell` (`components/app-shell.tsx`) | `Header.tsx` & `TabBar.tsx` | ✅ **100% Parity** | Compact safe-area header with store context, truthful sync status badge (Online, Offline, Syncing, Synced, Err), quick avatar menu. |
| **Navigation Drawer** | `AppShell` sidebar (`components/app-shell.tsx`) | `DrawerNav.tsx` | ✅ **100% Parity** | Complete Web navigation hierarchy: Dashboard, Billing, Inventory (Products, Adjust Stock, Stock History), Contacts (Customers, Suppliers), Purchases, Reports, Finance (Profit, Expenses), Settings. |
| **Dashboard** | `/` (`routes/index.tsx`) | `DashboardScreen.tsx` | ✅ **100% Parity** | Live time-based greeting, IST clock, 6 KPI cards (Today's Sales, Today's Orders, Today's Profit, Inventory Value, Pending Adjustments, Low Stock Alerts), Quick actions, AI Insights, Recent Transactions, Top Products. Online live server fetch + offline SQLite fallback. |
| **Billing Register** | `/billing` (`routes/billing.lazy.tsx`) | `BillingScreen.tsx` | ✅ **100% Parity** | Instant local product search, camera barcode scanner, real-time cart quantity pills, sticky bottom cart summary, slide-up checkout sheet with line/cart discounts, GST, round-off, cash tender quick shortcuts (₹50, ₹100, ₹200, ₹500, ₹1000, ₹2000), parked sales (held carts), and automatic one-tap thermal receipt printing. |
| **Shared Product Picker** | Reusable catalog component | `ProductPicker.tsx` | ✅ **100% Parity** | Unified catalog picker supporting `mode="sale"` (selling price, cart count) and `mode="purchase"` (cost price, purchase intake count), search, and category chips. |
| **Products Catalog** | `/products` (`routes/inventory.lazy.tsx`) | `ProductsScreen.tsx` | ✅ **100% Parity** | Filter tabs (All, Healthy, Low, Out), Category chips, Search by name/SKU/barcode, Add & Edit modal with canonical image URL resolution, prices, GST, stock thresholds, Archive/Restore. |
| **Adjust Stock** | `/adjust-stock` (`routes/stock-adjustments.tsx`) | `AdjustStockScreen.tsx` | ✅ **100% Parity** | 8 adjustment reasons (`OPENING_STOCK`, `PHYSICAL_COUNT`, `DAMAGED`, `LOST`, `FOUND`, `MANUAL_CORRECTION`, `SAMPLE`, `RETURN_FROM_CUSTOMER`), before/after stock preview, transactional SQLite mutation, Outbox sync. |
| **Stock History Ledger** | `/stock-history` (`routes/inventory.history.tsx`) | `StockHistoryScreen.tsx` | ✅ **100% Parity** | Inventory movement audit tracking Sales, Purchases, Adjustments, Restores with date filters, quantity in/out, balance stock. |
| **Customers Directory** | `/customers` (`routes/customers.tsx`) | `CustomersScreen.tsx` | ✅ **100% Parity** | Search by name/phone/invoice, customer stats (Total Spent, Visits, Last Visit), Add & Edit customer modal with GSTIN, customer details drawer with itemized invoice history. |
| **Suppliers Directory** | `/suppliers` (`routes/suppliers.lazy.tsx`) | `SuppliersScreen.tsx` | ✅ **100% Parity** | Supplier list with contact details, GSTIN, Total procurement spend, Purchase history, Add & Edit dialog. |
| **Purchase Stock (Inward)** | `/purchases` (`routes/purchases.lazy.tsx`) | `PurchasesScreen.tsx` | ✅ **100% Parity** | Summary KPI cards (Today's Purchases, PO Count, Total Procurement), Dual-tab navigation (History vs New Purchase Intake), ProductPicker integration, supplier selector with quick-add dialog, item cost/price/tax builder, stock auto-increment in SQLite, Purchase details view & Void mutation. |
| **Profit & Loss Analysis** | `/profit` (`routes/profit.lazy.tsx`) | `ProfitScreen.tsx` | ✅ **100% Parity** | Gross sales, COGS, Operating expenses, Gross profit, Net profit, Margin %, Profit by category breakdown, Product margin ranking table. |
| **Expenses Tracker** | `/expenses` (`routes/expenses.lazy.tsx`) | `ExpensesScreen.tsx` | ✅ **100% Parity** | Total expenses summary cards, Category filters (Rent, Utilities, Salary, Maintenance, Logistics, Tea & Snacks, Marketing, Misc), Add Expense dialog with payment mode & notes. |
| **Reports & Analytics** | `/reports` (`routes/reports.lazy.tsx`) | `ReportsScreen.tsx` | ✅ **100% Parity** | Period filters (Today, Yesterday, 7 Days, Month, Custom), Sales volume, Output GST, Average ticket size, Payment method breakdown (Cash, UPI, Card, Wallet), Category & Product sales rankings. |
| **Bills & Invoices** | `/reports` (Invoice history tab) | `BillsScreen.tsx` | ✅ **100% Parity** | Status filter (All, Completed, Voided), Date range filter, Payment method filter, Search by invoice/customer, itemized breakdown modal, VOID mutation with stock restoration, thermal reprint, WhatsApp link. |
| **Settings (Configuration Center V2)** | `/settings` (`routes/settings.lazy.tsx`) | `SettingsScreen.tsx` | ✅ **100% Parity** | Full 13-tab Configuration Center V2 layout: General, Org Profile, Security, Store Info, Branding, Billing POS, Purchase POS, Inventory, Printing & Hardware, WhatsApp, Taxes, Data Management, Advanced. |
| **Persistent Printer Profiles** | `/settings` (`printing` tab) | `PrinterService.ts` & `SettingsScreen.tsx` | ✅ **100% Parity** | Multi-driver printer profiles (BLUETOOTH, USB, BUILT_IN, MOCK). Configured default printer profile auto-routes one-tap checkout prints without asking every time. Profile add/edit/default/test/delete. |
| **Thermal Receipt Formatter** | ESC/POS receipt generation | `ReceiptFormatter.ts` | ✅ **100% Parity** | 32-column text representations with store branding, itemized purchased lines, unit prices, discounts, tax breakdown, VOID watermark, and store footer. |
| **Offline-First Sync Engine** | Offline queue + Delta sync | `sync.service.ts` & SQLite `outbox` | ✅ **100% Parity** | Safe non-destructive delta ingestion, exponential backoff for pending mutations, automatic synchronization of Sales, Customers, Products, Purchases, Expenses, Suppliers, Adjustments, and Settings. |
| **Super Admin Portal** | `/super-admin` | *N/A* | 🌐 **Web-Only (By Design)** | Super Admin multi-tenant management is restricted to Web admin dashboards per architectural specifications. |

---

## 2. Verified Data Architecture & Business Logic

1. **Currency Normalization Standard**:
   - Backend database and SQLite stores currency fields (`selling_price`, `cost_price`, `subtotal`, `grand_total`, `tax`, `discount`, `total_spent`) in **paise** (integers).
   - Domain layers and UI components expose clean **Rupee** values.
   - Sync engine and repository batch ingestion routines preserve raw server integers without double-multiplication.

2. **Cart & POS Calculation Formulas**:
   $$\text{Line Discount} = (\text{Price} \times \text{Qty}) \times \frac{\text{Discount \%}}{100}$$
   $$\text{Taxable Subtotal} = \text{Gross} - \sum \text{Line Discounts}$$
   $$\text{GST Output} = \text{Taxable Subtotal} \times \frac{\text{GST Rate}}{100}$$
   $$\text{Grand Total} = \text{Taxable Subtotal} - \text{Cart Flat Discount} + \text{GST} + \text{Round Off}$$
   $$\text{Net Profit} = \text{Sales Revenue} - \text{COGS} - \text{Expenses}$$

3. **Canonical Image Resolution**:
   - Cloudinary direct URLs: Preserved intact (`https://res.cloudinary.com/...`).
   - Relative backend URLs: Cleanly prefixed with active `API_BASE_URL`.
   - Null / Undefined / Broken images: Fall back to high-contrast placeholder icons without breaking component rendering.
