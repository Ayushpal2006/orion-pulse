# Apka Bill (Orion POS) — Comprehensive Deployment & Operations Runbook

> **Platform**: Apka Bill POS & Retail ERP  
> **Repository**: `Ayushpal2006/orion-pulse`  
> **Canonical Path**: `/Users/ayush/Code/ApkaBill/orion-pulse`  
> **Status**: Production Reference Manual  

---

## 1. System Topology & Architecture

Apka Bill is structured as an offline-first, multi-tenant monorepo deployed across Cloudflare edge compute, Neon serverless PostgreSQL, and native Android devices.

```
                           +-----------------------------------+
                           |        Browser / Mobile Web       |
                           +-----------------+-----------------+
                                             |
                                             v
                           +-----------------------------------+
                           | Cloudflare Worker: apkabill       |
                           | (TanStack Start SSR & Static CDN) |
                           +-----------------+-----------------+
                                             |
                                             v
                           +-----------------------------------+
                           | Cloudflare Worker: orion-pos-api  |
                           | (Express 5 REST API, nodejs_compat)|
                           +-----------------+-----------------+
                                             |
                                             v
                           +-----------------------------------+
                           | Cloudflare Hyperdrive Pooler      |
                           | ID: 9a81c8bc8b224db18cd430f43b531b69|
                           +-----------------+-----------------+
                                             |
                                             v
                           +-----------------------------------+
                           | Neon PostgreSQL Serverless DB     |
                           | Region: AWS ap-southeast-1        |
                           +-----------------------------------+
```

### Production Edge Endpoints
- **Frontend Worker**: `https://apkabill.ayushpalworkplace2006.workers.dev`
- **Backend Worker**: `https://orion-pos-api.ayushpalworkplace2006.workers.dev`
- **Database Hyperdrive Binding**: `HYPERDRIVE` (ID: `9a81c8bc8b224db18cd430f43b531b69`)
- **Android Package**: `com.apkabill.pos` (Capacitor 8.5.0)

---

## 2. Local Development Workflow

To run the complete Apka Bill stack on a local development machine:

```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse

# Single-command startup (starts local PostgreSQL, backend on :8080, frontend on :8081)
npm run dev
```

### Dev Accounts & Seed Credentials
- **Org Admin**: `admin@orion.com` | Password: `admin123`
- **Super Admin**: `superadmin@apkabill.com` | Password: `SuperAdmin@123`

### Local Database Management
```bash
# Push Drizzle schema changes to local Postgres
cd backend && npx drizzle-kit push

# Launch Drizzle Studio GUI on localhost:4983
cd backend && npx drizzle-kit studio
```

---

## 3. CI/CD Architecture & Safeguards

To prevent accidental deployments and ensure 100% test coverage before release, deployment is governed by two separate GitHub workflows:

### A. Automatic Quality Gate (`.github/workflows/ci.yml`)
- **Trigger**: Every push to `main`, `fix/*`, `feat/*`, and all Pull Requests.
- **Action**:
  - Compiles TypeScript for backend (`npm run build:backend`)
  - Validates currency scaling matrix (`node scripts/verify-amount-scale-fix.mjs`)
  - Runs backend unit tests (`bun test src/tests/worker-jwt-env.test.ts`)
  - Compiles frontend SSR and client bundles (`npm run build:frontend`)
- **Safety Rule**: **STRICTLY NO DEPLOYMENT IN CI.YML**. It is purely verification and gatekeeping.

### B. Manual Production Deployment (`.github/workflows/deploy-manual.yml`)
- **Trigger**: `workflow_dispatch` ONLY (Manual trigger in GitHub Actions UI).
- **Required Inputs**:
  - `target`: `all`, `backend`, or `frontend`
  - `confirm`: Must explicitly type `CONFIRM`
- **Concurrency**: `production-cloudflare-deploy` (prevents overlapping deployments).
- **Environment**: `production` (supports manual GitHub reviewer approvals).

---

## 4. Configuring GitHub Repository Secrets

To enable GitHub Actions manual deployment, configure the following secrets in GitHub:
Navigate to: **GitHub -> Ayushpal2006/orion-pulse -> Settings -> Secrets and variables -> Actions**

1. `CLOUDFLARE_API_TOKEN`:
   - Generate in Cloudflare Dashboard: **User Profile -> API Tokens -> Create Custom Token**
   - Permissions: `Account.Worker Scripts:Edit`, `Account.Worker Routes:Edit`, `Account.Account Settings:Read`
2. `CLOUDFLARE_ACCOUNT_ID`:
   - Value: `39a716c83994d4385c3ab94b74282e4a`

> [!IMPORTANT]
> **Disable Native Cloudflare Git Deployments**:
> Ensure Cloudflare Workers Dashboard does **not** have "Builds & deployments via GitHub" connected directly for `apkabill` or `orion-pos-api`. All deployments must be governed through GitHub Actions to prevent race conditions.

---

## 5. Terminal Deployment (Authorized Emergency Procedure)

If an authorized engineer needs to perform an emergency manual deployment directly from the terminal:

### Step 1: Pre-Flight Verification
Always verify builds and unit tests locally before running deploy commands:
```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse

# 1. Verify currency scaling
node scripts/verify-amount-scale-fix.mjs

# 2. Verify backend build & tests
npm run build:backend
bun test backend/src/tests/worker-jwt-env.test.ts

# 3. Verify frontend build
npm run build:frontend
```

### Step 2: Deploy Backend Worker (`orion-pos-api`)
```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse/backend
npx wrangler deploy --name orion-pos-api
```

### Step 3: Deploy Frontend Worker (`apkabill`)
```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse/frontend
npx wrangler deploy --name apkabill dist/server/index.mjs \
  --compatibility-date 2026-03-01 \
  --compatibility-flags nodejs_compat \
  --assets dist/public
```

### Step 4: Post-Deployment Smoke Verification
```bash
# Verify backend API and database connection pool
curl -s https://orion-pos-api.ayushpalworkplace2006.workers.dev/health/db

# Verify backend health status
curl -s https://orion-pos-api.ayushpalworkplace2006.workers.dev/health

# Verify frontend HTTP status
curl -s -I https://apkabill.ayushpalworkplace2006.workers.dev | head -n 5
```

---

## 6. Capacitor Android Mobile App Build (`com.apkabill.pos`)

The Android application uses Capacitor 8.5.0 with static SPA assets.

### 1. Build Static Frontend Assets
```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse/frontend

# Build static SPA assets into dist-capacitor/client
npm run build:capacitor

# Sync assets and plugins to Android project
npx cap sync android
```

### 2. Compile Android APK / AAB
```bash
cd /Users/ayush/Code/ApkaBill/orion-pulse/frontend/android

# Set Java 21 environment
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"

# Build Debug APK (for testing on devices)
./gradlew assembleDebug --no-daemon
# Output: frontend/android/app/build/outputs/apk/debug/app-debug.apk

# Build Release AAB (for Google Play Store upload)
./gradlew bundleRelease --no-daemon
# Output: frontend/android/app/build/outputs/bundle/release/app-release.aab
```

---

## 7. Rollback & Incident Response

### Instant Cloudflare Worker Rollback
If a deployment introduces a regression:
1. Open Cloudflare Dashboard -> **Compute (Workers) -> Workers & Pages**.
2. Select the affected Worker (`apkabill` or `orion-pos-api`).
3. Navigate to **Deployments**.
4. Identify the previous stable deployment and click **Rollback to this deployment**.
5. Alternatively, using the terminal:
   ```bash
   cd backend && npx wrangler rollback --name orion-pos-api <DEPLOYMENT_ID>
   ```

### Emergency Database Recovery
Database dumps are preserved as read-only references:
- Full backup bundle: `/Users/ayush/Code/ApkaBill/.git-recovery-backup/orion-pulse-full-backup.bundle`
- Working tree diff: `/Users/ayush/Code/ApkaBill/.git-recovery-backup/pre-recovery-working-tree.patch`
- In accordance with production safeguards, never run `DROP TABLE` or destructive scripts against the live Neon database without explicit offline verification.
