# Orion POS — Interactive Frontend Prototype

A production-quality, offline-first POS prototype built in React + TypeScript + Tailwind + shadcn/ui. All data is mocked in local state — no backend. Fully responsive across 5" Android POS terminals, tablets, and desktop.

## Design System

- Palette: warm off-white base, near-black ink, single vivid accent (emerald for success/money, amber for warnings, rose for destructive). No blue gradients.
- Rounded-2xl cards, soft ambient shadows, generous spacing, large 44px+ tap targets.
- Typography: tight display headings, comfortable body, tabular numerals for money.
- Motion: 150–250ms transitions, subtle spring on cart add / stock badge changes.
- Semantic tokens added to `src/styles.css` (money, success, warn, danger, surface, elevated). No hardcoded colors in components.

## Shell & Navigation

- Responsive shell in `__root.tsx`:
  - Desktop/tablet: persistent left sidebar (Dashboard, Billing, Inventory, Customers, Reports) + top bar with search, offline badge, profile avatar dropdown (role switcher + settings).
  - ≤640px (5" POS): bottom nav with the same 5 tabs + top-right avatar; sidebar hidden.
- Global command palette (⌘/Ctrl+K, or search icon) with grouped results across products, customers, invoices, quick actions.
- "100% Offline Mode Operational" pill in shell header, pulses green.
- Role context (Admin/Manager/Cashier) drives visibility — Cashier sees no Settings/Profit/Delete; blocked items show "Access Denied" state.

## Modules

**Dashboard** — Metric cards (Revenue, Orders, Profit, Inventory w/ low-stock trigger), 3–4 AI Insight cards with rotating simulated copy, stylized area/line sales chart (Recharts) with Today/Week/Month/Year filter chips, Quick Actions row (New Sale, Add Product, Purchase Stock).

**Billing** — Two-pane on tablet/desktop, stacked on POS:
- Left: search bar (name/SKU/barcode), "Scan Barcode" button that pushes a random mock product in with a toast, product grid.
- Right: cart list with qty +/−, remove, per-line discount %, GST split, totals block (Subtotal, Discount, GST, Grand Total).
- Customer block: mobile input; known numbers auto-fill name/LTV, unknown shows "New Customer" badge with inline name field.
- Payment grid: Cash / UPI / Card / Wallet toggle tiles.
- Checkout dialog runs a scripted sequence with animated step ticks: Validating Stock → Local SQLite Entry → Generating Invoice → Print Preview (thermal slip modal with dynamic UPI QR via `qrcode.react`) → Queueing WhatsApp → Done. Target feel: <3s end-to-end.

**Inventory** — Grid of product cards on POS, table on desktop. Columns: Name, SKU, Barcode, Purchase, Selling, GST %, Stock. Stock badge color-coded (Healthy/Low/Out). Actions: Add Product modal (form with validation), Generate Barcode modal (renders SVG barcode via `jsbarcode`).

**Customers** — List sorted by mobile number, click opens profile drawer with Total Purchases, LTV, Last Visit, and an expandable timeline of past invoices (mock).

**Reports** — Tabs: Sales (Daily/Monthly), Profit Analysis, GST. Each tab shows a chart + summary table + Export to PDF / Export to Excel buttons (toast only). Profit tab hidden for Cashier.

**Settings** — Business config (Shop Name, GSTIN), Printer selector (Internal POS / Bluetooth / USB) with "Test Print" toast, Role switcher (Admin/Manager/Cashier), theme toggle. Entire route blocked for Cashier.

## Technical Notes

- Routes under `src/routes/`: `_app.tsx` layout (shell + Outlet), `_app.index.tsx` (Dashboard), `_app.billing.tsx`, `_app.inventory.tsx`, `_app.customers.tsx`, `_app.reports.tsx`, `_app.settings.tsx`. Each has proper `head()` metadata.
- Mock data in `src/lib/mock/` (products, customers, invoices, insights) with seeded deterministic values.
- Global app state via a small Zustand store: cart, role, offline flag, command-palette open, current customer. No server calls.
- Reusable primitives: `MetricCard`, `StockBadge`, `RolePermission`, `CommandPalette`, `ThermalSlipPreview`, `StepSequenceDialog`.
- Libraries to add: `recharts`, `zustand`, `qrcode.react`, `jsbarcode`, `cmdk` (already via shadcn), `sonner` (already).
- Strict TS, no `any`, semantic tokens only, all interactions local-state driven.

## Out of Scope

No real persistence, no real printing, no backend/Cloud, no auth. Everything is client-side simulated for a convincing prototype.
