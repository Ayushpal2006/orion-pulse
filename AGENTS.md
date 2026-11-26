# Apka Bill / Orion POS — Workspace Engineering Rules

This repository is an offline-first, cloud-synced multi-tenant Point of Sale (POS) and Retail ERP platform.

---

## 1. Monorepo Architecture & Paths

- `orion-pulse/backend`: Express 5, TypeScript, Drizzle ORM, PostgreSQL (Neon), Cloudflare Workers.
- `orion-pulse/frontend`: React, TanStack Start, Vite, TailwindCSS v4, Capacitor Android bridge (`frontend/android`).
- `orion-pulse/mobile`: React Native 0.87.0, SQLite local-first POS, sync worker.
- `orion-pulse/mobile-expo`: Expo POS client (maintained as fallback).
- `orion-pulse/scripts`: Verification, audit, and benchmark scripts.

---

## 2. Non-Negotiable Financial & Currency Rules

1. **Database Monetary Values Are In Integer PAISE:**
   - PostgreSQL (`sales`, `sale_items`, `purchase_orders`, `expenses`, `products`) stores all monetary amounts in **integer PAISE** (₹1,200.00 = `120000`).
   - SQLite offline stores (`sales`, `products`, `sync_queue`) store integer PAISE.
2. **REST API Currency Boundary:**
   - Client checkout requests (`POST /api/checkout`) pass amounts in **RUPEES**.
   - `CheckoutService` multiplies by 100 (`Math.round(val * 100)`) exactly once before database persistence.
   - Offline sync payloads must convert paise to rupees at sync time (`queuedPayloadToCheckoutRequest`) to avoid double-scaling.
3. **Discounts & Partial Payments:**
   - Ensure `discount`, `paid_amount`, and `balance` are converted consistently. Never assume a bill is paid in full if partial payment was specified.

---

## 3. Multi-Tenant Data Isolation

- Every table query must enforce `organization_id = :orgId` and `store_id = :storeId`.
- Customers and suppliers are visible across stores within the *same* organization when intended, but NEVER cross organization boundaries.
- Cross-tenant ID lookups must be rejected with `403 Forbidden`.
- Normal users cannot alter their `organization_id` via request headers.

---

## 4. Verification & Build Commands

Always run from `orion-pulse/`:

| Scope | Command | Purpose |
| :--- | :--- | :--- |
| **Full Build** | `npm run build` | Compiles backend (`tsc`) and frontend (Vite/TanStack Start) |
| **Backend Build** | `npm run build:backend` | TypeScript compile + migrations/assets copy |
| **Frontend Build**| `npm run build:frontend` | Vite client and server bundle build |
| **Capacitor Android**| `cd frontend && npm run build:capacitor` | Static SPA build for Android WebView |
| **Backend Tests** | `bun test src/tests/<test-file>.ts` | Fast backend verification |
| **Amount Matrix Check**| `node scripts/verify-amount-scale-fix.mjs` | Regression test for ₹1,200 and decimal edge cases |

---

## 5. Production Safeguards

- Never run `wrangler deploy` without explicit user instruction.
- Never commit credentials, tokens, or JWT secrets. Production requires environment-supplied `JWT_SECRET`.
- Production database dumps (`*.dump`, `*.sql`) are read-only references; never overwrite production data.
