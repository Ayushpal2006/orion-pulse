# Deployment, rollback and secrets

## Infrastructure (verified 2026-11-27)

| Piece | Name / URL | Deployed by |
|---|---|---|
| API Worker | `orion-pos-api` at https://orion-pos-api.ayushpalworkplace2006.workers.dev | `.github/workflows/deploy.yml` (`backend/wrangler.toml`) |
| Web Worker | `apkabill` at https://apkabill.ayushpalworkplace2006.workers.dev | `.github/workflows/deploy.yml` (`frontend` build writes `dist/server/wrangler.json`) |
| Database | Neon project "Apka Bill", branch `production`, through Hyperdrive `orion-pos-neon` | **Not deployed by CI.** Migrations are applied by hand. |
| Custom domains / routes | none (workers.dev only) | — |
| Cloudflare Pages | none | — |

## Pipeline

- **Pull request or branch push** runs `ci.yml`:
  - secret scan of the new commits (gitleaks);
  - backend: `tsc` build, amount-scale matrix, unit tests, and DB-backed auth tests on a throwaway Postgres (`test-login-matrix.ts`, `test-login-backdoor.ts`);
  - frontend: `tsc --noEmit`, `bun test src`, production build;
  - ESLint, report only (769 existing errors).
  - No preview deploys: both Workers share the production database through Hyperdrive, so a preview would write to production data.
- **Push to `main`** runs `deploy.yml`:
  1. `guard` checks that the Cloudflare secrets exist. A missing secret fails the run; it is never skipped silently. Then it picks the targets from the diff:
     - `backend/` or the root lockfile: backend;
     - `frontend/` except `frontend/android/`: frontend;
     - a workflow change: both.
  2. `checks` runs the same `ci.yml`. Nothing deploys unless every required check passes.
  3. `deploy-backend` and `deploy-frontend` each do the following:
     - record the current version for rollback;
     - deploy with message `ci <sha>`;
     - confirm the active deployment carries that message;
     - health-check: API `/health` and `/health/db`, web `/` and `/login`;
     - write the commit, version, previous version and URL to the run summary.
  4. Frontend waits for the backend and never ships after a failed backend deploy.
- Only one production deploy runs at a time (`concurrency: production-cloudflare-deploy`, never cancelled midway).
- Manual deploy: Actions, then "Production Deploy", then "Run workflow". Pick a target and type `CONFIRM`.

## Database changes (separate, manual, approved)

CI never runs migrations. Follow these steps in order.

1. Write an idempotent migration in `backend/src/db/migrations/`.
2. Test it on the local DB (port 5433).
3. Get approval. Then run it in the Neon SQL editor on branch `production`.
4. Only then push the code that needs it.

## Rollback (manual; not automatic)

Each failed deploy prints the exact command in its run summary. Rollback switches traffic to a previous version that Cloudflare already holds. It does not rebuild, and it does not touch the database.

```bash
cd orion-pulse/backend
npx wrangler deployments list --name orion-pos-api       # find the last good version id ("ci <sha>")
npx wrangler rollback <version-id> --name orion-pos-api -m "rollback: <reason>"
npx wrangler rollback <version-id> --name apkabill -m "rollback: <reason>"   # web, if needed
curl -s https://orion-pos-api.ayushpalworkplace2006.workers.dev/health/db
```

Then revert the bad commit on `main` (`git revert <sha>`, no force-push), so the next deploy does not bring it back.

Status: the procedure is documented but has **not yet been exercised on production**. A rollback is itself a production change and needs owner approval.

Rollback limits:
- Secrets are not versioned with code. Rolling back does not undo a `wrangler secret put`.
- A version that needs a newer DB schema can still be rolled back, but its old code must tolerate the new columns. Keep migrations additive.

## Required secrets checklist

| Where | Name | Purpose | Status 2026-11-27 |
|---|---|---|---|
| GitHub repo secret | `CLOUDFLARE_API_TOKEN` | wrangler deploy / deployments / rollback | set (2026-11-27) |
| GitHub repo secret | `CLOUDFLARE_ACCOUNT_ID` | account for wrangler | set |
| Worker secret (`orion-pos-api`) | `JWT_SECRET` | signs sessions; rotating it logs everyone out | set |
| Worker secret (`orion-pos-api`) | `SUPER_ADMIN_PASSWORD` | super-admin login (`superadmin@orion.com`) | set, **but does not match the stored approved credential**; see the login incident notes |
| Worker secret (`orion-pos-api`) | `GOOGLE_TOKEN_ENCRYPTION_KEY` | Google OAuth token encryption | set |
| Worker binding | Hyperdrive `orion-pos-neon` | DB access | in `wrangler.toml` |

Least-privilege Cloudflare token, created under My Profile, then API Tokens, then Custom token:
- Account: Workers Scripts, Edit.
- Account: Account Settings, Read.
- User: User Details, Read. Wrangler needs it for `whoami` and membership lookup.
- Account: Hyperdrive, Read. Only add it if a deploy fails with a Hyperdrive permission error.
- Scope: the one account only. Set an expiry date.

The current token's scopes cannot be read from GitHub. Compare it in the Cloudflare dashboard.

GitHub OIDC is not used: Cloudflare API tokens cannot be issued from GitHub OIDC, so a scoped, expiring token is the available option.
