# Performance Baseline and Roadmap — 2026-11-27

Scope: production Neon project "Apka Bill" (free plan), Worker `orion-pos-api` via Hyperdrive, web Worker `apkabill`, Expo mobile client.
Method: read-only `pg_stat_user_tables` / `pg_indexes` on production, code reading, and local Postgres 18 tests. No load was generated against production. Query counts below come from reading the code, not from measurement.

## 1. Measured baseline (production, cumulative stats)

| Table | Rows | Seq scans | Tuples read by seq scans | Notes |
|---|---|---|---|---|
| sync_jobs | 12,266 | 6,326 | 33.4 M | only the pkey index existed |
| sales | 3,869 | 12,046 | 27.2 M | |
| sale_items | 6,385 | 9,045 | 23.9 M | |
| customers | 2,094 | 17,230 | 18.5 M | |
| settings | — | 37,968 | — | logo data URLs stored in `value` |
| stores | 6 | 115,263 | — | read on nearly every request |
| organizations | — | 45,639 | — | |

- Neon network transfer: **91.5 % of the monthly free allowance used**. This is the binding constraint, not CPU.
- Root cause of the transfer: shop logos stored as ~400 KB data URLs in `stores.logo_url`, `organizations.logo_url` and `settings.value`, read by full-row `select()` on hot paths.
- `pg_stat_statements` was reset recently, so per-query latency is not available yet. Re-check in 7 days.

Index drift (schema.ts vs production): the only real gap was `sync_jobs` (3 declared indexes missing). The inventory_movements and suppliers differences are name-only, with equivalent indexes under other names.

## 2. Done (local commits, not yet deployed)

| Commit | Change | Effect |
|---|---|---|
| 0cd9ad9, 68c9534 | settings `get/getAll` and branding read the logo only when needed | removes repeated ~400 KB reads per settings call |
| 4ed42f7 | receipt builder selects only `name`, `code` from stores and organizations | removes 2 logo copies (~800 KB) per checkout and receipt |
| 22eb7a4 | web: printer config cached in memory; invoice-history loop fixed; search debounced 300 ms | one /settings per page load instead of one per print; no endless /customers loop |
| 34c5d44 | worker no longer runs schema DDL on every new isolate | removes an ACCESS EXCLUSIVE lock on `products` per isolate start |
| 653a35f | sync upload: per-invoice advisory lock; no fallback to product id 1; legacy pull returns full delta | duplicate offline sales prevented (test: 5 concurrent → 1); shipped Expo app no longer stuck on page 1 |
| 50a447e | profit monthly trend bounded to the last 12 months | correct chart (was oldest 12 months) and no full-history aggregate |
| 2bbd9c3 | migration 0024: sync_jobs indexes | needs a manual production apply (approval) |

Tests: `src/tests/test-sync-integrity.ts`, `src/tests/test-profit-trend-window.ts` (both fail without their fix), plus the existing receipt, branding-isolation, checkout-amount and WhatsApp tests.

## 3. Roadmap (ranked by cost to production)

| # | Item | Risk | Needs approval |
|---|---|---|---|
| 1 | Deploy the commits above | low | yes (push = prod deploy) |
| 2 | Apply migration 0024 on production | low, additive | yes |
| 3 | Sync download: exclude logo keys from `settings`; page products/customers by id | low | no |
| 4 | Checkout: read settings once with `key IN (...)`; lock cart products with one `SELECT ... FOR UPDATE`; batch movement inserts | medium (money path) | no, but needs the amount matrix |
| 5 | Enqueue sync_jobs with `tx` so a rolled-back sale leaves no job; move `processQueue` to a Cron trigger | medium | Cron is free; confirm |
| 6 | KOT list N+1 → one `inArray` query | low | no |
| 7 | Unbounded list endpoints (products, customers, suppliers, movements): default limit 200, max 1000 | medium (clients may expect full lists) | check clients first |
| 8 | Auth: drop the nested `router.use(authenticate())` on /stores and /users | low | no |
| 9 | Unique index `sales(organization_id, store_id, invoice_number)` | medium: check prod for existing duplicates first | yes |
| 10 | Move logos out of the DB (R2 or Cloudflare Images) | medium, data move | yes (production data transformation) |

Not planned: Redis, read replicas, queues, partitioning. At ~4k sales and 6 stores, they add cost and failure modes without a measured need.

## ADR-001: Keep the per-request pg Pool behind Hyperdrive

Hyperdrive pools connections at the edge, and Workers cannot share sockets across requests. The per-request Pool stays. Parallel `Promise.all` branches open extra connections through Hyperdrive, which is acceptable at current load. Revisit if Hyperdrive connection errors appear.

## ADR-002: Legacy sync clients get an unpaged delta

The shipped Expo app sends neither `pageSize` nor `sweepStart` and ignores `hasMore`. Paging it caused an infinite re-pull of the first page. Requests without paging params get the full delta, as before paging existed. New clients opt into paging by sending `pageSize`.
