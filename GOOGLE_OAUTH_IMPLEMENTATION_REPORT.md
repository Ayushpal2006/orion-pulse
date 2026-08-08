# GOOGLE WORKSPACE OAUTH 2.0 INTEGRATION REPORT (Phase 1 + Phase 2)

## Executive Summary

This report documents the implementation of **Phase 1 (Google OAuth 2.0)** and **Phase 2 (Spreadsheet Picker)** for the multi-tenant Apka Bill / Orion POS SaaS platform.

Manual Spreadsheet ID entry has been replaced with Google OAuth 2.0 Authorization Code flow and interactive spreadsheet selection from the user's Google Drive. The legacy Service Account implementation remains fully functional as a fallback method (**Google Sync Method: Google Account [Recommended] vs Service Account [Legacy]**).

---

## 1. Database Migration & Schema

### New Table: `google_integrations`

Defined in `backend/src/db/schema.ts` and programmatically created during application startup in `backend/src/database/init.ts`.

```sql
CREATE TABLE IF NOT EXISTS google_integrations (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  store_id INTEGER REFERENCES stores(id),
  google_user_id TEXT,
  google_email TEXT,
  refresh_token TEXT NOT NULL, -- Encrypted at rest via AES-256-GCM
  spreadsheet_id TEXT,
  spreadsheet_name TEXT,
  connected_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_sync TIMESTAMP,
  sync_enabled INTEGER DEFAULT 1 NOT NULL,
  sync_method TEXT DEFAULT 'oauth' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_google_integrations_org_id ON google_integrations (organization_id);
CREATE INDEX IF NOT EXISTS idx_google_integrations_store_id ON google_integrations (store_id);
```

### Encryption & Token Security

- **Algorithm**: AES-256-GCM authenticated encryption.
- **Key**: Derived securely from `ENCRYPTION_KEY` / `JWT_SECRET`.
- **Policy**: Access tokens are **never** stored permanently in the database. Only encrypted refresh tokens are stored per `organization_id`.

---

## 2. Backend Routes & API List

All routes are mounted at `/api/google` in `backend/src/server.ts` and use strict session-derived `organization_id` isolation.

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/google/auth` | Yes | Generates Google OAuth authorization URL with `openid`, `email`, `profile`, `drive.readonly`, `spreadsheets` scopes and signed JWT `state`. |
| `GET` | `/api/google/callback` | No (JWT State) | Handles OAuth callback from Google. Exchanges `code` for tokens, encrypts refresh token, and upserts `google_integrations` row. |
| `GET` | `/api/google/status` | Yes | Returns `{ connected, email, spreadsheetName, spreadsheetId, lastSync, syncMethod }` for the tenant. |
| `GET` | `/api/google/spreadsheets` | Yes | Queries Google Drive API (`mimeType='application/vnd.google-apps.spreadsheet'`) and returns list of user spreadsheets `[{ id, name }]`. |
| `POST` | `/api/google/spreadsheet` | Yes | Verifies spreadsheet existence via Drive API and updates `spreadsheet_id` & `spreadsheet_name` for the tenant context. |
| `POST` | `/api/google/select-spreadsheet` | Yes | Alias for `/api/google/spreadsheet`. |
| `POST` | `/api/google/disconnect` | Yes | Removes OAuth tokens and spreadsheet mapping for the tenant context without deleting any spreadsheets in Google Drive. |
| `POST` | `/api/google/sync-method` | Yes | Toggles tenant preferred sync method between `oauth` (Recommended) and `service_account` (Legacy). |

---

## 3. OAuth 2.0 Authorization Flow

```
[Frontend Settings]
       │
       ▼
1. GET /api/google/auth ────────► Generates OAuth Consent URL
                                            │
                                            ▼
2. [User Consent Page] ─────────► User authorizes application
                                            │
                                            ▼
3. GET /api/google/callback ◄─── Redirected back with code & signed state
   ├─ Verifies state token (organization_id)
   ├─ Exchanges authorization code for tokens
   ├─ Fetches Google User Profile (email & user ID)
   ├─ Encrypts refresh token using AES-256-GCM
   └─ Saves/updates record in google_integrations
                                            │
                                            ▼
4. Redirect to Frontend ────────► /settings?google_auth=success
                                            │
                                            ▼
5. GET /api/google/spreadsheets ─► User picks Google Sheet from dropdown
                                            │
                                            ▼
6. POST /api/google/spreadsheet ──► Configuration saved for Tenant
```

---

## 4. Multi-Tenant Organization Isolation

- **Non-Negotiable Boundary**: Every lookup, save, and sync operation strictly uses `organization_id` derived from `getTenantContext()` (authenticated JWT session).
- Frontend `organization_id` parameters in request body or query params are **never trusted**.
- No organization can access or modify another organization's refresh tokens or spreadsheet selections.

---

## 5. Files Changed

| Component | File Path | Description |
|---|---|---|
| Database Schema | `backend/src/db/schema.ts` | Added `google_integrations` table definition and indices. |
| Database Initialization | `backend/src/database/init.ts` | Added programmatic `CREATE TABLE IF NOT EXISTS google_integrations` migration query. |
| Crypto Utilities | `backend/src/utils/crypto.ts` | Created AES-256-GCM encryption/decryption helper functions. |
| API Routes | `backend/src/routes/google.routes.ts` | Created OAuth auth, callback, status, spreadsheets list, save spreadsheet, and disconnect endpoints. |
| Server | `backend/src/server.ts` | Mounted `google.routes.ts` at `/api/google`. |
| Sync Engine | `backend/src/services/sync.service.ts` | Enhanced `SyncQueueManager` to support dual-mode client resolution (`oauth` vs `service_account`). |
| Frontend UI | `frontend/src/routes/settings.lazy.tsx` | Added Google Workspace card under Settings → Backup & Restore with Google Backup Method feature toggle, Connect Google, and Spreadsheet Picker dropdown. |
| Unit & Integration Tests | `backend/src/tests/test-google-oauth-integration.ts` | Added automated test suite for encryption, schema, and multi-tenant isolation. |

---

## 6. Testing & QA Verification

1. **Token Encryption & Decryption**:
   - `encryptToken` produces AES-256-GCM formatted ciphertext (`iv:authTag:cipherHex`).
   - `decryptToken` recovers exact plaintext token.

2. **Multi-Tenant Isolation**:
   - Automated script `src/tests/test-google-oauth-integration.ts` executed with `9/9 PASSED`.
   - Script `src/tests/test-google-sheets-isolation.ts` executed with `PASSED`.

3. **TypeScript Compilation**:
   - `backend`: `npx tsc --noEmit` ➔ `0 errors`
   - `frontend`: `npx tsc --noEmit` ➔ `0 errors`

4. **Production Builds**:
   - `frontend`: `npm run build` ➔ Success.
   - `backend`: `npm run build` ➔ Success.

---

## 7. Remaining Work Before Phase 3

Before initiating Phase 3 (Automated Sync & Sheet Generation), the following tasks are scheduled:

1. **Configuring Production Google Workspace Client Credentials**:
   - Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in production `.env`.
   - Add production redirect URI to Google Cloud Console Authorized Redirect URIs (`https://app.apkabill.com/api/google/callback`).

2. **Phase 3 Roadmap (Automated Synchronization Engine)**:
   - Auto-creation of POS spreadsheets if user opts out of choosing existing sheet.
   - Automatic worksheet setup (Sales, Inventory, Customers, Reports).
   - Real-time row append & ledger mirror execution via background worker queue.
