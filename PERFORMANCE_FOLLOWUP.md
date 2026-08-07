# Apka Bill / Orion POS — Performance Followup & Architectural Recommendations

**Document Date**: August 7, 2026  
**Focus Area**: API Payload Analysis, Offline/PWA Requirements, and DOM Virtualization Evaluation.

---

## 1. API Payload Analysis

### Endpoint: `GET /products`
- **Fields Returned by Backend**: `id`, `organization_id`, `store_id`, `name`, `sku`, `barcode`, `category`, `purchase_price`, `selling_price`, `stock`, `minimum_stock`, `gst`, `is_active`, `image_url`, `margin_percent`, `markup_percent`, `average_cost`, `last_purchase_cost`, `max_stock`, `reorder_quantity`, `preferred_supplier_id`, `created_at`, `updated_at`.
- **Fields Consumed by Frontend**:
  - Billing Screen: `id`, `name`, `sku`, `barcode`, `price` (`selling_price`), `stock`, `gst`, `category`, `image_url`.
  - Inventory Screen: `id`, `name`, `sku`, `barcode`, `category`, `purchase_price`, `selling_price`, `stock`, `minimum_stock`, `gst`, `is_active`, `image_url`, `margin_percent`, `markup_percent`, `average_cost`.
- **Full Dataset Requirement Analysis**:
  - **Billing & POS Scanner**: REQUIRES full active product list cached in client memory (`useApp` Zustand store or IndexedDB `offline-db.ts`) for instant sub-10ms barcode lookup during rapid item scanning. Requesting pagination for barcode scanning would introduce network latency during scanning.
  - **Offline/PWA Operation**: Service worker and local SQLite/IndexedDB sync depend on complete active product availability to permit offline checkouts when internet connectivity drops.
- **Recommendation**: Retain unpaginated full fetch for active products on checkout/PWA initial sync, but project selective columns (`EXCLUDE admin/audit columns`) if inventory scales beyond 20,000 SKUs.

---

### Endpoint: `GET /customers`
- **Fields Returned by Backend**: `id`, `organization_id`, `store_id`, `name`, `phone`, `email`, `address`, `notes`, `total_orders`, `lifetime_value`, `last_visit`, `type`, `is_system`, `is_protected`, `is_active`, `created_at`, `updated_at`.
- **Fields Consumed by Frontend**:
  - Customers Screen: `id`, `name`, `phone`, `lifetime_value`, `total_orders`, `last_visit`, `created_at`, `email`, `address`, `notes`.
  - Billing Customer Lookup: `id`, `name`, `phone`.
- **Recommendation**: Initial load is cached under single React Query key `["customers"]`. For stores with >5,000 registered customers, implement server-side cursor pagination for the Customers CRM table while preserving instant local phone lookup for Billing.

---

### Endpoint: `GET /sales`
- **Fields Returned by Backend**: `id`, `organization_id`, `store_id`, `invoice_number`, `customer_id`, `cashier_name`, `payment_method`, `subtotal`, `discount`, `gst`, `grand_total`, `paid_amount`, `balance`, `public_token`, `pdf_url`, `shared_at`, `created_at`, `status`, `void_reason`, `voided_by`, `voided_at`.
- **Fields Consumed by Frontend**: Invoice History component consumes all sales fields for receipt rendering and void processing.
- **Recommendation**: Paginated endpoint `GET /sales/search-paginated` is already implemented in backend (`PostgresSaleRepository.searchSalesPaginated`). The Invoice History view should transition to this paginated endpoint when historical invoices exceed 10,000 transactions.

---

## 2. Frontend DOM Virtualization Evaluation

### Billing Product Grid (`src/routes/billing.lazy.tsx`)
- **Current Rendering**: Product cards are rendered in a responsive CSS Grid (`grid-cols-2` to `grid-cols-4`).
- **Node Count**: Each card mounts ~12 DOM nodes. For a catalog of 200 items, ~2,400 DOM nodes are present, which operates smoothly at 60 FPS.
- **Virtualization Recommendation**: If a store inventory exceeds 1,000 SKUs displayed simultaneously without category filtering, integrate `@tanstack/react-virtual` grid windowing.

### Inventory Table (`src/routes/inventory.lazy.tsx`)
- **Current Rendering**: Renders HTML table rows for filtered products with stock badges and action dropdowns.
- **Node Count**: ~15 DOM nodes per row.
- **Virtualization Recommendation**: Integrate `@tanstack/react-virtual` table row windowing when SKU count exceeds 500 rows per page view.
