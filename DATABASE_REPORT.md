# Database Report — Orion POS v1.0 Stable

This report documents the PostgreSQL Drizzle configuration for Orion POS Version 1.0.

---

## 1. Schema Layout
The database is structured to support single-store POS workflows with strict ACID verification. Key tables include:
- `stores`: Basic profile configuration.
- `users`: Standard user login profiles with role designations (Admin, Manager, Cashier).
- `products`: Product catalog containing SKU, barcode, costing columns (`purchase_price`, `selling_price`, `average_cost`, `minimum_stock`).
- `customers`: Customer profiles tracking lifetime value and orders.
- `sales` / `sale_items`: Checkout transactions tracking items, line totals, and payment status.
- `purchase_orders` / `purchase_items`: Procurement purchase logs recording costs.
- `returns` / `return_items`: Processed item returns log.
- `inventory_logs`: Unified stock level transaction changes ledger.

## 2. Constraints & Index Optimizations
- **Composite Indexes**: Mapped on products SKU (`idx_products_sku`) and customer phone (`idx_customers_phone`) to ensure fast searches.
- **Constraints**: Database uses strict foreign key bounds linking `sale_items` to `products`, and cascade deletions to prevent database corruption.
- **Pooling**: Using Drizzle Pool (`pg` connection client) to reuse active connections and reduce handshake overhead.
