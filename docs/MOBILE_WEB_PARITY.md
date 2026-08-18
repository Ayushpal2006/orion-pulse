# MOBILE WEB PARITY AUDIT & ARCHITECTURE MATRIX
**Project**: `mobile-expo/`  
**Target Environment**: Android Expo Cashier & Store Operations App  
**Source of Truth**: Web Application (`frontend/src/`) & Backend API (`backend/src/`)  
**Audit Date**: August 18, 2026  

---

## 1. Web Parity Audit Matrix

| Web Feature | Web Route / Component | Mobile Screen | Mobile Status | Missing Functionality (To Implement) |
| :--- | :--- | :--- | :--- | :--- |
| **Global Navigation Shell** | `AppShell` (`components/app-shell.tsx`) | `AppShell` / `DrawerNav` / `TabBar` | ✅ Complete | Nested expandable drawer mirroring Web hierarchy (Inventory, Contacts, Finance), Store Switcher badge, Online/Offline sync status badge, Global search bar, User Profile avatar. |
| **Dashboard** | `/` (`routes/index.tsx`) | `DashboardScreen.tsx` | ✅ Complete | Greeting ("Good morning/afternoon/evening ☀️") + IST clock, 6 KPI cards (Today's Sales, Orders + Avg ticket, Profit + Margin %, Inventory Value, Pending Adjustments, Low Stock Alerts), Quick actions grid (New Sale, Add Product, Purchase Stock, Adjust Stock), Sales Trend cards, AI Insights, Recent Transactions with VOID indicator, Top Selling Products, Low Stock list. |
| **Billing Register** | `/billing` (`routes/billing.lazy.tsx`) | `BillingScreen.tsx` | ✅ Complete | 2-column responsive layout, barcode scanning with visual flash feedback, category chips, line item discounts (%), cash note quick-tender shortcuts (₹50, ₹100, ₹200, ₹500, ₹1000, ₹2000), parked sales (held carts), round-off calculation, sale notes, ESC/POS print & WhatsApp receipt. |
| **Products Catalog** | `/products` (`routes/inventory.lazy.tsx`) | `ProductsScreen.tsx` | ✅ Complete | Filter tabs (All, Healthy, Low, Out), Search by name/SKU/barcode, Category chips, Add/Edit product dialog with image preview, selling & cost prices, stock thresholds, Archive/Restore. |
| **Adjust Stock** | `/adjust-stock` (`routes/stock-adjustments.tsx`) | `AdjustStockScreen.tsx` | ✅ Complete | Complete Web stock adjustment screen: 8 adjustment types (`OPENING_STOCK`, `PHYSICAL_COUNT`, `DAMAGED`, `LOST`, `FOUND`, `MANUAL_CORRECTION`, `SAMPLE`, `RETURN_FROM_CUSTOMER`), Product autocomplete picker with live before/after calculation, Reason & notes, Audit log table. |
| **Stock History** | `/stock-history` (`routes/inventory.history.tsx`) | `StockHistoryScreen.tsx` | ✅ Complete | Inventory movement ledger tracking Sales, Purchases, Adjustments, and Restores with date filters, quantity in/out, balance stock, and transaction references. |
| **Customers Directory** | `/customers` (`routes/customers.tsx`) | `CustomersScreen.tsx` | ✅ Complete | Search by name/phone/invoice, Total spent, Visit count, Add/Edit customer modal with GSTIN & address, Customer Detail drawer with invoice purchase history. |
| **Suppliers Directory** | `/suppliers` (`routes/suppliers.lazy.tsx`) | `SuppliersScreen.tsx` | ✅ Complete | Supplier list with search, contact details, GSTIN, Total procurement spend, Purchase order history, Add/Edit supplier dialog. |
| **Purchase Stock** | `/purchases` (`routes/purchases.lazy.tsx`) | `PurchasesScreen.tsx` | ✅ Complete | Summary KPI cards (Today's purchases, PO count, Total procurement), History vs New Purchase tabs, Supplier selector with quick-add dialog, Supplier invoice number, payment status, product picker, item cost/price/tax builder, stock auto-increment in SQLite, Purchase details view & Void mutation. |
| **Profit & Loss** | `/profit` (`routes/profit.lazy.tsx`) | `ProfitScreen.tsx` | ✅ Complete | Gross sales, COGS, Operating expenses, Gross profit, Net profit, Margin %, Profit by category breakdown, Product margin ranking table. |
| **Expenses Tracker** | `/expenses` (`routes/expenses.lazy.tsx`) | `ExpensesScreen.tsx` | ✅ Complete | Total expenses summary cards, Category filters (Rent, Utilities, Salary, Maintenance, Logistics, Tea & Snacks, Marketing, Miscellaneous), Add Expense dialog with payment mode & notes, delete confirmation. |
| **Reports & Analytics** | `/reports` (`routes/reports.lazy.tsx`) | `ReportsScreen.tsx` | ✅ Complete | Period filters (Today, Yesterday, 7 Days, Month, Custom), Sales volume, Output GST, Average ticket size, Payment method breakdown (Cash, UPI, Card, Wallet), Category & Product sales rankings. |
| **Bills & Invoices** | `/reports` (Invoice history tab) | `BillsScreen.tsx` | ✅ Complete | Status filter (All, Completed, Voided), Date range filter, Payment method filter, Search by invoice/customer, itemized breakdown modal, VOID transaction mutation with stock restoration, thermal reprint, WhatsApp link. |
| **Settings (Configuration Center V2)** | `/settings` (`routes/settings.lazy.tsx`) | `SettingsScreen.tsx` | ✅ Complete | Orion Configuration Center V2 UI: Export/Import Config, Settings Search, Horizontal tabs (General, Organization Profile, Security & Password, Store Information, Branding, Billing POS, Purchase POS, Inventory, Printing & Hardware, WhatsApp Templates, Taxes & GST, Data Management, Advanced & System), Reset section, Save all changes. |
| **Hardware & Printer Settings** | `/settings` (Printing tab) | `PrinterSettingsSection.tsx` | ✅ Complete | Multi-printer profiles (Thermal 58mm/80mm, Bluetooth, USB, ESC/POS), default printer auto-selection, test print receipt, auto-print on checkout toggle. |


---

## 2. Information Architecture & Navigation Mapping

```
Mobile App Shell
├── Top Bar: [☰ Hamburger (Drawer)] [Search (⌘K)] [Store Context] [Sync Badge] [Theme] [User Avatar]
├── Navigation Drawer (Full Web Hierarchy):
│   ├── 📊 Dashboard
│   ├── 💳 Billing
│   ├── 📦 Inventory
│   │   ├── Products
│   │   ├── Adjust Stock
│   │   └── Stock History
│   ├── 👥 Contacts
│   │   ├── Customers
│   │   └── Suppliers
│   ├── 🛍️ Purchases
│   ├── 📈 Reports
│   ├── 💰 Finance
│   │   ├── Profit
│   │   └── Expenses
│   └── ⚙️ Settings (Configuration Center V2)
├── Main Content View (Active Screen)
└── Bottom Navigation Bar: [Home] [Billing] [Products] [Purchases] [Customers]
```

---

## 3. Data & Business Logic Convergence Rules

1. **Local-First SQLite Authority**: Every read and mutation executes immediately in local SQLite with transactions and indexes before background outbox synchronization.
2. **Tenant Isolation**: Every query and mutation is strictly filtered by the authenticated `store_id` (default: 1) and `organization_id`.
3. **Receipt Formats**: Thermal ESC/POS receipts format 58mm/80mm text using the canonical receipt model matching Web print layouts, with VOID watermarks.
4. **Calculations**:
   - $\text{Line Discount} = (\text{Price} \times \text{Qty}) \times \frac{\text{Discount \%}}{100}$
   - $\text{Taxable Subtotal} = \text{Gross} - \text{Line Discounts}$
   - $\text{GST} = \text{Taxable Subtotal} \times \frac{\text{GST Rate}}{100}$
   - $\text{Grand Total} = \text{Taxable Subtotal} - \text{Cart Discount} + \text{GST} + \text{Round Off}$
   - $\text{Net Profit} = \text{Sales Revenue} - \text{COGS} - \text{Expenses}$
