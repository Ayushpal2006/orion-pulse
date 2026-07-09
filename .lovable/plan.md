## Orion POS — Feature Expansion Plan

Scope: extend the existing prototype only. No routing/architecture/design changes. All data stays in Zustand mock state.

---

### 1. Theme system
- Add `theme: "light" | "dark" | "system"` to `useApp` store, persisted via `localStorage` (hydrated in `useEffect` to avoid SSR mismatch).
- New `ThemeToggle` component (dropdown: Sun/Moon/Monitor). Mounted in top bar (beside profile) and inside Settings.
- Applies `dark` class on `<html>`; smooth color transition via CSS on `html { transition: background-color .3s, color .3s }`.

### 2. Store extensions (single source of truth)
Add to `src/lib/store.ts`:
- `theme`, `setTheme`
- `parkedSales: { id, label, cart, customerName, customerMobile, payment, savedAt }[]` + `parkSale()`, `resumeSale(id)`, `deleteParkedSale(id)`
- `customers: Customer[]` (seeded from mock) + `addCustomer/updateCustomer/deleteCustomer`
- `updateProduct`, `deleteProduct`, `duplicateProduct`, `adjustStock(id, delta, reason)`
- Settings: `logo`, `currency`, `receiptHeader`, `receiptFooter`, `upiId`, `qrPosition`, `paperWidth (58|80)`, `storeAddress`, `storePhone`, `storeEmail`, `taxRate` — with setters.
- Extend `Product` type with `updatedAt`, `createdAt`, `image?`, `minStock` (rename from `reorder` alias-preserving).

### 3. Inventory page
- Category chips (All + derived from products), status filter (Healthy/Low/Out), sort dropdown (Price/Stock/Name/Newest).
- Row click → `ProductDetailsDrawer` (shadcn Sheet) with all fields + action buttons (Edit / Adjust Stock / Print Barcode / Duplicate / Delete).
- `EditProductDialog` (reuses Add layout, prefilled).
- `DeleteProductDialog` (AlertDialog confirm).
- `StockAdjustmentDialog`: mode Increase/Decrease, qty, reason (Purchase/Damage/Return/Manual).
- Sticky "Add product" FAB on mobile.

### 4. Billing page
- Customer phone lookup: on 10-digit entry, resolve from store customers. If found → show green "Returning customer" chip with LTV/visits/last purchase; if not → show "New customer — Quick Add" inline (small form; on save, continues billing seamlessly, no modal loop).
- **Park Sale**: "Hold" button in cart header saves current cart into `parkedSales` with auto-label (customer name or timestamp) and clears cart. "Parked (n)" popover lists parked sales → Resume / Delete. Resuming replaces current cart (with confirm if cart non-empty).
- Sticky checkout bar on mobile.

### 5. Customers page
- Add/Edit/Delete via dialog (Name, Phone, Email, Address, Notes). AlertDialog for delete.

### 6. Reports page
- Filter bar: chips (Today, Yesterday, Last 7, Last 30, This Month, Last Month, This Year, Custom). Custom opens shadcn date range calendar popover.
- Regenerate mock series deterministically from range → charts + tables update.

### 7. Settings page
- New sections: Business (logo upload preview via FileReader, address/phone/email, currency select, tax %), Receipt (header/footer/UPI ID/QR position/paper width 58|80 with live receipt preview card), Theme selector, Backup/Restore placeholder buttons (toast).

### 8. Dashboard
- Reorder sections only: KPI 2×2 grid → Quick Actions → Sales Overview → AI Insights → Recent Transactions → Top Selling Products → Low Stock Alerts. Add Top Selling + Low Stock sections (reuse card styles).

### 9. Command palette
- Extend groups: Products, Customers, Invoices, Categories, Settings sections, Reports tabs, Inventory, Quick actions. Fuzzy search via existing cmdk.

### 10. Polish
- Reusable `EmptyState` and `Skeleton` usage on lists.
- `hover-scale` / `animate-fade-in` on cards, subtle button press feedback.
- Larger tap targets (h-12) on mobile primary buttons; bottom-sheet variant of Dialog on `useIsMobile()` where noted (Add/Edit product, Stock Adjust, Park list).

---

### Files to add
- `src/components/theme-toggle.tsx`
- `src/components/product-details-drawer.tsx`
- `src/components/edit-product-dialog.tsx`
- `src/components/stock-adjustment-dialog.tsx`
- `src/components/customer-dialog.tsx`
- `src/components/parked-sales.tsx`
- `src/components/receipt-preview.tsx`
- `src/components/empty-state.tsx`

### Files to edit
- `src/lib/store.ts`, `src/lib/mock-data.ts`
- `src/routes/__root.tsx` (top bar toggle, theme init)
- `src/routes/index.tsx`, `billing.tsx`, `inventory.tsx`, `customers.tsx`, `reports.tsx`, `settings.tsx`
- `src/components/command-palette.tsx`, `src/styles.css` (transition)

### Out of scope (per instructions)
No backend, auth, real persistence beyond `localStorage` theme, printer/WhatsApp integrations, redesign.
