# MOBILE WEB PARITY AUDIT & EXACT REPLICATION MATRIX
**Project**: `mobile-expo/`  
**Target Environment**: Android Expo Cashier & Store Operations App  
**Source of Truth**: Web Application (`frontend/src/`) & Backend API (`backend/src/`)  
**Audit Date**: August 18, 2026  

---

## 1. Executive Parity Audit Matrix

| Web Feature | Web Route / Component | Mobile Screen / Component | Mobile Status | Missing Functionality / Parity Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Global App Shell & Header** | `AppShell` (`components/app-shell.tsx`) | `Header.tsx` & `TabBar.tsx` & `App.tsx` | ✅ 100% Parity | Global store context, online/offline sync status badge, search bar trigger, user profile, and bottom tabs. |
| **Navigation Drawer** | `AppShell` sidebar (`components/app-shell.tsx`) | `DrawerNav.tsx` | ✅ 100% Parity | Exact Web navigation hierarchy with expandable submenus: Dashboard, Billing, Inventory (Products, Adjust Stock, Stock History), Contacts (Customers, Suppliers), Purchases, Reports, Finance (Profit, Expenses), Settings. |
| **Dashboard** | `/` (`routes/index.tsx`) | `DashboardScreen.tsx` | ✅ 100% Parity | Live time-based greeting + IST clock, 6 KPI cards (Today's Sales, Today's Orders with Avg ticket, Today's Profit with margin %, Inventory Value, Pending Adjustments, Low Stock Alerts), Quick actions grid, Range filters (Today, Week, Month, Year), AI Insights derived from live ledger data, Recent Transactions list with VOID tags, Top Selling Products, Low Stock list. |
| **Billing Register** | `/billing` (`routes/billing.lazy.tsx`) | `BillingScreen.tsx` | ✅ 100% Parity | Responsive product grid & category chips, live SKU/barcode search, camera barcode scanner, cart line item discount (%), cash note quick tenders (₹50, ₹100, ₹200, ₹500, ₹1000, ₹2000), parked sales (held carts), customer selection & quick-add, GST calculation, atomic SQLite checkout, ESC/POS thermal printing, WhatsApp receipt share. |
| **Products Catalog** | `/products` (`routes/inventory.lazy.tsx`) | `ProductsScreen.tsx` | ✅ 100% Parity | Filter tabs (All, Healthy, Low, Out), Category chips, Search by name/SKU/barcode, Add & Edit product modal with image URLs/fallbacks, selling/cost prices, GST rates, stock thresholds, and Archive/Restore actions. |
| **Adjust Stock** | `/adjust-stock` (`routes/stock-adjustments.tsx`) | `AdjustStockScreen.tsx` | ✅ 100% Parity | 8 adjustment reasons (`OPENING_STOCK`, `PHYSICAL_COUNT`, `DAMAGED`, `LOST`, `FOUND`, `MANUAL_CORRECTION`, `SAMPLE`, `RETURN_FROM_CUSTOMER`), product selector with live before/after stock preview, notes, SQLite transactional stock mutation, audit history log. |
| **Stock History Ledger** | `/stock-history` (`routes/inventory.history.tsx`) | `StockHistoryScreen.tsx` | ✅ 100% Parity | Comprehensive inventory movement ledger tracking Sales, Purchases, Adjustments, and Restores with date filters, quantity in/out, balance stock, and transaction reference badges. |
| **Customers Directory** | `/customers` (`routes/customers.tsx`) | `CustomersScreen.tsx` | ✅ 100% Parity | Search by name/phone/invoice, customer statistics (Total Spent, Visit Count, Last Visit), Add & Edit customer modal with GSTIN and address, customer details drawer with itemized invoice history. |
| **Suppliers Directory** | `/suppliers` (`routes/suppliers.lazy.tsx`) | `SuppliersScreen.tsx` | ✅ 100% Parity | Supplier list with contact details, GSTIN, Total procurement spend, Purchase order history, Add & Edit supplier dialog. |
| **Purchase Stock (Inward)**| `/purchases` (`routes/purchases.lazy.tsx`) | `PurchasesScreen.tsx` | ✅ 100% Parity | Summary KPI cards (Today's Purchases, PO Count, Total Procurement), History vs New Purchase tabs, Supplier selector with quick-add dialog, Supplier invoice number, payment status, product picker, item cost/price/tax builder, stock auto-increment in SQLite, Purchase details view & Void mutation. |
| **Profit & Loss Analysis** | `/profit` (`routes/profit.lazy.tsx`) | `ProfitScreen.tsx` | ✅ 100% Parity | Gross sales, COGS, Operating expenses, Gross profit, Net profit, Margin %, Profit by category breakdown, Product margin ranking table. |
| **Expenses Tracker** | `/expenses` (`routes/expenses.lazy.tsx`) | `ExpensesScreen.tsx` | ✅ 100% Parity | Total expenses summary cards, Category filters (Rent, Utilities, Salary, Maintenance, Logistics, Tea & Snacks, Marketing, Miscellaneous), Add Expense dialog with payment mode & notes, delete confirmation. |
| **Reports & Analytics** | `/reports` (`routes/reports.lazy.tsx`) | `ReportsScreen.tsx` | ✅ 100% Parity | Period filters (Today, Yesterday, 7 Days, Month, Custom), Sales volume, Output GST, Average ticket size, Payment method breakdown (Cash, UPI, Card, Wallet), Category & Product sales rankings. |
| **Bills & Invoices** | `/reports` (Invoice history tab) | `BillsScreen.tsx` | ✅ 100% Parity | Status filter (All, Completed, Voided), Date range filter, Payment method filter, Search by invoice/customer, itemized breakdown modal, VOID transaction mutation with stock restoration, thermal reprint, WhatsApp link. |
| **Settings (Configuration Center V2)** | `/settings` (`routes/settings.lazy.tsx`) | `SettingsScreen.tsx` | ✅ 100% Parity | Complete Orion Configuration Center V2 layout: Export/Import Config JSON modals, Settings search, 13 Horizontal scroll tabs, Reset Section, Save All Changes, atomic SQLite persistence. |
| - *General Settings* | Section `general` | `SettingsScreen.tsx` (`general` tab) | ✅ 100% Parity | Currency symbol, Store locale, Timezone (IST), Language. |
| - *Organization Profile* | Section `organization` | `SettingsScreen.tsx` (`organization` tab) | ✅ 100% Parity | Organization name, Legal entity, Website, PAN/GST, State/Province. |
| - *Security & Password* | Section `security` | `SettingsScreen.tsx` (`security` tab) | ✅ 100% Parity | Cashier PIN, Manager security overrides, require PIN on VOID transactions. |
| - *Store Information* | Section `shop` | `SettingsScreen.tsx` (`store` tab) | ✅ 100% Parity | Store name, physical address, contact phone, contact email, GSTIN, UPI ID. |
| - *Branding & Visuals* | Section `branding` | `SettingsScreen.tsx` (`branding` tab) | ✅ 100% Parity | Logo URL, Store tagline, primary accent color selector. |
| - *Billing POS Settings* | Section `billing` | `SettingsScreen.tsx` (`billing` tab) | ✅ 100% Parity | Invoice prefix (`INV-`), starting number, negative stock toggle, quick billing mode, auto-print receipt toggle, default round-off, receipt header/footer, terms & conditions. |
| - *Purchase POS Settings*| Section `purchase` | `SettingsScreen.tsx` (`purchase` tab) | ✅ 100% Parity | PO prefix (`PO-`), starting number, autofill purchase cost toggle. |
| - *Inventory Settings* | Section `inventory` | `SettingsScreen.tsx` (`inventory` tab) | ✅ 100% Parity | Low stock threshold alert number, default HSN code, auto SKU generation. |
| - *Printing & Hardware* | Section `printing` | `SettingsScreen.tsx` (`printing` tab) | ✅ 100% Parity | Paper width (58mm/80mm), ESC/POS thermal printing toggle, printer driver selection, default printer profile, instant Test Print. |
| - *WhatsApp Templates* | Section `whatsapp` | `SettingsScreen.tsx` (`whatsapp` tab) | ✅ 100% Parity | Customizable message template with placeholders (`{store_name}`, `{customer_name}`, `{invoice_number}`, `{amount}`, `{payment_method}`). |
| - *Taxes & GST* | Section `taxes` | `SettingsScreen.tsx` (`taxes` tab) | ✅ 100% Parity | Default GST rate (0%, 5%, 12%, 18%, 28%), Tax inclusive/exclusive pricing mode. |
| - *Data Management & Backup* | Section `backup` & `data` | `SettingsScreen.tsx` (`data` tab) | ✅ 100% Parity | Database backup, Google Sheets sync trigger, local SQLite storage cleaner, export data snapshots. |
| - *Advanced & System* | Section `advanced` | `SettingsScreen.tsx` (`advanced` tab) | ✅ 100% Parity | Backend API endpoint, SQLite database status, sync queue inspect, diagnostic logs. |

---

## 2. Global Mobile Navigation Hierarchy

```
Mobile App Shell (Orion POS Mobile Expo)
├── Top Bar
│   ├── [☰] Drawer Trigger
│   ├── Store Context & Badge (e.g. "Main Outlet #1")
│   ├── Sync Status Indicator (Online 🟢 / Offline 🔴 / Syncing 🟡 / Synced ✅)
│   └── User Avatar & Store Identity
│
├── Navigation Drawer (1:1 Web Navigation Hierarchy)
│   ├── 📊 Dashboard
│   ├── 💳 Billing
│   ├── 📦 Inventory (Expandable)
│   │   ├── Products
│   │   ├── Adjust Stock
│   │   └── Stock History
│   ├── 👥 Contacts (Expandable)
│   │   ├── Customers
│   │   └── Suppliers
│   ├── 🛍️ Purchases
│   ├── 📈 Reports
│   ├── 💰 Finance (Expandable)
│   │   ├── Profit
│   │   └── Expenses
│   └── ⚙️ Settings (Configuration Center V2)
│
├── Active Screen Viewport (Scrollable, Native-Optimized)
│
└── Bottom Tab Bar (Quick Access Core Routes)
    ├── 📊 Home (Dashboard)
    ├── 💳 Billing (Register)
    ├── 📦 Products (Catalog)
    ├── 🛍️ Purchases (Stock Intake)
    └── 👥 Customers (CRM)
```

---

## 3. Data & Business Logic Architecture

1. **Local-First SQLite Authority**:
   - All mutations (Sales, Purchases, Stock Adjustments, Customers, Suppliers, Expenses, Settings) execute immediately against SQLite in ACID transactions.
   - UI reflects changes in $< 5\text{ms}$.
   - Mutations generate change records in the Outbox for background sync to the central PostgreSQL database.

2. **Strict Multi-Tenant Isolation**:
   - Queries and repositories automatically scope all records to `store_id` (default: 1) and `organization_id`.
   - Never loads cross-tenant or cross-store data.

3. **Canonical Calculations**:
   - **Line Discount**: $\text{Line Discount} = (\text{Price} \times \text{Qty}) \times \frac{\text{Discount \%}}{100}$
   - **Taxable Subtotal**: $\text{Taxable Subtotal} = \text{Gross} - \sum \text{Line Discounts}$
   - **GST Output**: $\text{GST} = \text{Taxable Subtotal} \times \frac{\text{GST Rate}}{100}$
   - **Grand Total**: $\text{Grand Total} = \text{Taxable Subtotal} - \text{Cart Flat Discount} + \text{GST} + \text{Round Off}$
   - **Net Profit**: $\text{Sales Revenue} - \text{COGS} - \text{Expenses}$

4. **Hardware & Receipt Parity**:
   - Receipts conform to Web ESC/POS canonical receipt structures for both 58mm and 80mm formats.
   - Auto-uses default printer profile without redundant cashier prompts.
   - Includes itemized lines, discounts, tax breakup, VOID watermark if voided, and store footer.
