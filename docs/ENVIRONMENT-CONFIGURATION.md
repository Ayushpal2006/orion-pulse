# Apka Bill (Orion POS) — Comprehensive Environment Configuration

> **Author**: Apka Bill DevOps & Infrastructure  
> **Status**: Canonical Reference  
> **Repository**: `Ayushpal2006/orion-pulse`  
> **Target Cloud Platforms**: Cloudflare Workers (`apkabill`, `orion-pos-api`), Neon PostgreSQL (AWS `ap-southeast-1`), Capacitor Android (`com.apkabill.pos`).

---

## 1. System Architecture Overview

Apka Bill operates across three runtime environments:

1. **Local Development (Single-Command)**:
   - Command: `npm run dev` (via `scripts/run-local.mjs`)
   - Backend runs on Node.js/Express (`http://localhost:8080`)
   - Frontend runs on Vite/TanStack Start dev server (`http://localhost:8081`)
   - Database: Local PostgreSQL 17/18 (`postgresql://postgres:postgres@localhost:5432/orion`)
   - Storage: Local filesystem (`backend/uploads/products`, `backend/uploads/invoices`)

2. **Cloudflare Serverless Production**:
   - Frontend: Cloudflare Worker `apkabill` serving SSR & static assets (`https://apkabill.ayushpalworkplace2006.workers.dev`)
   - Backend: Cloudflare Worker `orion-pos-api` running on `nodejs_compat` (`https://orion-pos-api.ayushpalworkplace2006.workers.dev`)
   - Database: Neon Serverless PostgreSQL (`ep-raspy-star-azxw88lm-pooler.c-3.ap-southeast-1.aws.neon.tech`)
   - Database Connection Pooler: Cloudflare Hyperdrive binding (`HYPERDRIVE`, ID: `9a81c8bc8b224db18cd430f43b531b69`)
   - Media Storage: Cloudinary (stateless remote CDN)

3. **Capacitor Android Mobile POS (`com.apkabill.pos`)**:
   - Hybrid Web container compiled with `CAPACITOR_BUILD=1 vite build` into `dist-capacitor/client`
   - Native Android bridge running Capacitor 8.5.0
   - Offline storage: Browser IndexedDB + SQLite sync queue
   - Production API target: `https://orion-pos-api.ayushpalworkplace2006.workers.dev`

---

## 2. Frontend Configuration Variables

Vite statically analyzes code and inlines environment variables prefixed with `VITE_` at build time.

| Variable Name | Default Fallback | Production Setting | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8080` | `https://orion-pos-api.ayushpalworkplace2006.workers.dev` | Base REST API URL used by all Axios / Fetch client instances. |
| `CAPACITOR_BUILD` | Unset (`undefined`) | `1` (set automatically during `npm run build:capacitor`) | Switches TanStack Start from SSR/Nitro mode into static SPA prerendering mode for Android asset packaging. |

### Build-Time Inlining & Deterministic Resolution

In `frontend/src/lib/api.ts`:
```typescript
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.origin.includes("localhost")
    ? "http://localhost:8080"
    : "https://orion-pos-api.ayushpalworkplace2006.workers.dev");
```

- In development (`npm run dev`), `frontend/.env.development.local` sets `VITE_API_URL=http://localhost:8080`.
- In production (`npm run build:frontend` or CI), `frontend/.env.production` is tracked in Git (without secrets) and sets `VITE_API_URL=https://orion-pos-api.ayushpalworkplace2006.workers.dev`.
- In Capacitor Android emulator builds, override with: `VITE_API_URL=http://10.0.2.2:8080 npm run cap:sync`.

---

## 3. Backend Configuration Variables

Backend configuration is loaded and validated by `backend/src/config/env.ts`.

| Variable Name | Default / Local Dev | Production / Cloudflare | Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | `8080` | Managed by Cloudflare runtime | Optional | HTTP listen port for local Node.js Express server. |
| `NODE_ENV` | `development` | `production` | Optional | Runtime mode. Controls error verbosity and secure cookie flags. |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/orion` | Direct Neon pooler connection URL | Yes (in local dev / migrations) | Direct PostgreSQL connection string. |
| `HYPERDRIVE_URL` | Unset | Injected by Cloudflare Hyperdrive binding | Yes (in Cloudflare Worker) | Connection string synthesized by Cloudflare Hyperdrive. |
| `JWT_SECRET` | `orion-pos-secret-key-change-in-prod` | Injected via `wrangler.toml [vars]` or GitHub Secret | Yes | Symmetric key for signing and verifying JSON Web Tokens. |
| `JWT_EXPIRES_IN`| `24h` | `24h` | Optional | Lifespan for emitted authentication tokens. |
| `ALLOWED_ORIGINS`| `http://localhost:8081,...` | `*` | Yes | Permitted origins for CORS headers (`Access-Control-Allow-Origin`). |
| `TRUST_PROXY` | `1` | `1` | Optional | Tells Express to trust reverse proxy headers (`X-Forwarded-For`). |
| `CLOUDINARY_URL` | Unset | Cloudinary connection URI | Optional | Unified Cloudinary connection URL. |
| `CLOUDINARY_CLOUD_NAME` | Unset | Cloudinary cloud identifier | Optional (Required if uploads enabled) | Product images and PDF invoice remote storage. |
| `CLOUDINARY_API_KEY` | Unset | Cloudinary API Key | Optional (Required if uploads enabled) | Authenticates Cloudinary uploads. |
| `CLOUDINARY_API_SECRET` | Unset | Cloudinary Secret Key | Optional (Required if uploads enabled) | Signs Cloudinary API requests. |
| `ADMIN_EMAIL` | `admin@orion.com` | Configurable | Optional | Seeded organization admin email. |
| `ADMIN_PASSWORD` | `admin123` | Configurable | Optional | Seeded organization admin password. |
| `SUPER_ADMIN_PASSWORD` | `SuperAdmin@123` | Strong secret | Required for production superadmin | Protects cross-organization platform administration endpoints. |

---

## 4. Cloudflare Hyperdrive Architecture

### What is Hyperdrive?
Cloudflare Workers run in ephemeral isolates distributed across 300+ edge locations. Traditional relational databases (PostgreSQL) require a TCP handshake and SSL negotiation for every new connection, which introduces a 100ms–300ms latency penalty on cold starts. Furthermore, opening hundreds of simultaneous connections from edge nodes can exhaust database connection pools.

Cloudflare Hyperdrive eliminates this bottleneck:
- It maintains warm, persistent connection pools close to the PostgreSQL database.
- It accelerates queries by pooling connections and caching reads.
- It provides a synthesized connection string (`env.HYPERDRIVE.connectionString`) accessible inside the Worker.

### Apka Bill Hyperdrive Configuration
- **Binding Name**: `HYPERDRIVE`
- **Hyperdrive ID**: `9a81c8bc8b224db18cd430f43b531b69`
- **Configured Host**: `ep-raspy-star-azxw88lm-pooler.c-3.ap-southeast-1.aws.neon.tech`
- **Database**: `neondb`
- **User**: `neondb_owner`
- **Port**: `5432`

### Safe Pool Detachment Pattern in `worker.ts`
Because Cloudflare Workers isolates can freeze or be reclaimed after an HTTP request finishes, unclosed socket handles will cause runtime exceptions. Apka Bill implements the `detachPool()` lifecycle hook:

```typescript
// backend/src/worker.ts
try {
  const response = await handleFetch(req, env);
  return response;
} finally {
  // Gracefully detach client connections so background sockets do not leak
  await detachPool();
}
```

---

## 5. Master Environment Variable Matrix

| Variable | Scope | Development Value | Production Value | Classification |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Frontend | `http://localhost:8080` | `https://orion-pos-api.ayushpalworkplace2006.workers.dev` | **Public** |
| `CAPACITOR_BUILD` | Frontend | `undefined` | `1` (for mobile APK) | **Public** |
| `PORT` | Backend | `8080` | Managed by edge platform | **Internal** |
| `NODE_ENV` | Backend / Frontend | `development` | `production` | **Internal** |
| `DATABASE_URL` | Backend | `postgresql://postgres:postgres@localhost:5432/orion` | Direct Neon pooler (migration-only) | **Secret** |
| `HYPERDRIVE` | Cloudflare Backend | *N/A (Local Postgres)* | Binding ID `9a81c8bc8b224db18cd430f43b531b69` | **Infrastructure** |
| `JWT_SECRET` | Backend | `orion-pos-secret-key-change-in-prod` | Cloudflare Worker variable / secret | **Secret** |
| `JWT_EXPIRES_IN` | Backend | `24h` | `24h` | **Internal** |
| `ALLOWED_ORIGINS` | Backend | `http://localhost:8081,...` | `*` | **Internal** |
| `SUPER_ADMIN_PASSWORD` | Backend | `SuperAdmin@123` | High-entropy secret | **Secret** |
| `CLOUDINARY_CLOUD_NAME` | Backend | *Empty* | Cloudinary account name | **Secret** |
| `CLOUDINARY_API_KEY` | Backend | *Empty* | Cloudinary API Key | **Secret** |
| `CLOUDINARY_API_SECRET` | Backend | *Empty* | Cloudinary API Secret | **Secret** |

---

## 6. Zero-Secret Git Compliance & Guidelines

1. **Never commit `.env` or `.env.local` files**:
   These are strictly ignored in `.gitignore`.
2. **Deterministic public configs are committed**:
   `frontend/.env.production` is deliberately tracked because it contains only the public API URL, ensuring CI and new clones never build against localhost.
3. **Submodule Safety**:
   Submodules (such as `mobile-expo`) have their own repository remotes and must never have secrets pushed.
