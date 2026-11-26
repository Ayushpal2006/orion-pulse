# Environment Configuration

Variable names only. Never commit real values. `.env` files are git-ignored; templates are `backend/.env.example` and `frontend/.env.example`.

## How the pieces connect

```
Browser / Capacitor app ──VITE_API_URL──▶ orion-pos-api Worker ──HYPERDRIVE binding──▶ Hyperdrive "orion-pos-neon" ──▶ Neon Postgres (db: neondb)
Local dev:  frontend :8081 ──http://localhost:8080──▶ backend (tsx watch) ──DATABASE_URL──▶ local Postgres "orion"
```

## Frontend (`orion-pulse/frontend`)

| Variable | Dev (`.env`, `.env.development.local`) | Production (`.env.production`, baked in at build) | Required |
|---|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | `https://orion-pos-api.ayushpalworkplace2006.workers.dev` | yes |

Resolution order in `frontend/src/lib/api.ts` (first match wins):
1. Runtime overrides: `window.__ENV__.VITE_API_URL`, `window.VITE_API_URL`, `window.API_BASE_URL`, `localStorage["VITE_API_URL"]`
2. Build-time `import.meta.env.VITE_API_URL`
3. Fallback `http://localhost:8080`

A trailing `/api` is stripped. The Capacitor build (`npm run build:capacitor`) uses `.env.production`, so the APK talks to the production API. To change the backend URL, edit `frontend/.env.production` and rebuild. If a browser shows the wrong API, check for a stale `localStorage["VITE_API_URL"]` override.

## Backend (`orion-pulse/backend`)

| Variable / binding | Used for | Local dev | Production (Worker `orion-pos-api`) | Required |
|---|---|---|---|---|
| `HYPERDRIVE` (binding) | Postgres connection | not used | `wrangler.toml` `[[hyperdrive]]`, id `9a81c8bc8b224db18cd430f43b531b69` (name `orion-pos-neon`, db `neondb`, verified with `wrangler hyperdrive get`) | prod: yes |
| `DATABASE_URL` | Postgres connection | `backend/.env` → local `orion` DB | Overridden by Hyperdrive when the binding exists | dev: yes |
| `JWT_SECRET` | Signs/verifies login tokens | Optional; the dev fallback is used only when `NODE_ENV` ≠ production | **Wrangler secret.** The Worker refuses auth without it. **Currently NOT set in production** (see below). | prod: yes |
| `JWT_EXPIRES_IN` | Token lifetime | default `24h` | default `24h` | no |
| `NODE_ENV` | Mode switch | `development` | `production` (`wrangler.toml` var) | yes |
| `ALLOWED_ORIGINS` | CORS | `.env` | `*` (`wrangler.toml` var). Recommend restricting to the frontend origin + Capacitor origin. | yes |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | Super-admin login | dev accepts built-in demo passwords | Super-admin login is disabled unless `SUPER_ADMIN_PASSWORD` is a secret | optional |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (or `CLOUDINARY_URL`) | Logo/image upload | optional | not set in production (no secrets exist) | optional |
| `GOOGLE_OAUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google Sheets OAuth | optional | not set | optional |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` (or `ENCRYPTION_KEY`) | Encrypts stored Google tokens. **Falls back to `JWT_SECRET`.** | optional | not set | recommended if Google sync is used |
| `GOOGLE_SYNC_ENABLED`, `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Legacy service-account sync | optional | not set | optional |
| `BASE_URL`, `PORT`, `TRUST_PROXY`, `DB_TYPE`, `DATABASE_PROVIDER`, `MOCK_POSTGRES` | Local server / tooling | `.env` | unused in the Worker | no |

How production gets its database: `backend/src/worker.ts` copies `env.HYPERDRIVE.connectionString` into `process.env.DATABASE_URL` on every request, so Hyperdrive always wins over a `DATABASE_URL` var. A fresh pg pool is created per request; the previous one is closed through `ctx.waitUntil`.

Check which DB is in use without exposing credentials:
- Production: `cd backend && npx wrangler hyperdrive get 9a81c8bc8b224db18cd430f43b531b69` (shows name/host/database, not the password)
- Local: `grep -oE '@[^/:]+' backend/.env` (host only)

## Production secrets status

- `JWT_SECRET` and `GOOGLE_TOKEN_ENCRYPTION_KEY` were rotated on 2026-11-26 and are stored as Wrangler secrets on `orion-pos-api` (deployed together with commit `799a322` using `wrangler deploy --secrets-file`). Nobody holds a copy; it is not needed outside the Worker.
- Tokens signed with the old repository string are rejected (verified against production: 401).
- Rotating again later: `cd backend && npx wrangler secret put JWT_SECRET --name orion-pos-api`. Everyone must sign in again; set `GOOGLE_TOKEN_ENCRYPTION_KEY` separately so Google connections survive a JWT rotation.
- Never roll `orion-pos-api` back to a version before `0895ecc3-6c14-4701-8e26-4ef71eebd9bf`: older versions accept forged tokens.

## CI/CD

- `.github/workflows/ci.yml`: build, money matrix, auth/admin tests and frontend tests on pushes to `main`, `fix/**`, `feat/**` and on PRs. Never deploys.
- `.github/workflows/deploy.yml`: every push to `main` runs pre-flight, deploys `orion-pos-api`, health-checks it, then deploys `apkabill`. Manual runs require typing `CONFIRM`.
- Required repo secrets (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`. Without them the deploy jobs are skipped, not failed.
- Vercel is also connected to this GitHub repo and builds every push (Preview for branches, Production for `main`). It does not touch Cloudflare. Disconnect it in Vercel if unused.
