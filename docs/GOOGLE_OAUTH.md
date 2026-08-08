# Google Workspace OAuth 2.0 Integration Documentation

## Executive Overview

Apka Bill / Orion POS provides a modern, secure Google Workspace OAuth 2.0 integration allowing multi-tenant SaaS organizations to connect their Google Drive and Google Sheets accounts seamlessly without manual service account credentials or raw Spreadsheet IDs.

---

## 1. Technical Architecture

```
[ Frontend: React / TanStack ]
             │
             ▼ 1. Click "Connect Google"
     GET /api/google/auth  (Sends JWT Bearer)
             │
             ▼ 2. Backend signs tenant context into state token
     Redirects to Google OAuth Consent Screen
             │
             ▼ 3. User approves permissions
     Google Redirects to /api/google/callback?code=...&state=...
             │
             ▼ 4. Backend verifies state token & exchanges code
     Exchanges code for Access & Refresh tokens via googleapis
             │
             ▼ 5. Refresh token encrypted via AES-256-GCM
     Stored in google_integrations table (Scoped strictly by organization_id)
             │
             ▼ 6. Redirect back to /settings?google_connected=true
```

---

## 2. OAuth 2.0 Authorization Flow

1. **Authorization Request (`GET /api/google/auth`)**:
   - Authenticated user requests auth URL.
   - Backend derives tenant context (`organization_id`, `store_id`, `user_id`) from session/context.
   - Signs state token with `JWT_SECRET` (15m expiry).
   - Generates Google OAuth URL with offline access mode (`access_type: "offline"`, `prompt: "consent"`).

2. **Granted Scopes**:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/spreadsheets`

3. **Callback Handling (`GET /api/google/callback`)**:
   - Validates `state` token to verify authenticated tenant org context.
   - Exchanges `code` for Google credentials (`access_token`, `refresh_token`, `id_token`).
   - Encrypts `refresh_token` using AES-256-GCM.
   - Upserts record in `google_integrations` database table.
   - Redirects user back to frontend `/settings`.

---

## 3. Security & Token Encryption

- **AES-256-GCM Encryption**:
  - Refresh tokens are encrypted before saving to PostgreSQL.
  - Storage format: `iv_hex:auth_tag_hex:encrypted_hex`.
  - Master Key derived via SHA-256 hash of `GOOGLE_TOKEN_ENCRYPTION_KEY`.
- **Zero Token Logging**:
  - Client Secrets, Access Tokens, Refresh Tokens, and Encryption Keys are never logged in console or log files.
- **Tenant Isolation**:
  - Multi-tenant database queries enforce `organization_id` strictly derived from session context.

---

## 4. Refresh Token Lifecycle & Auto-Refresh

- Access tokens expire every 60 minutes.
- When executing Google Drive / Sheets API calls, `oauth2Client.setCredentials({ refresh_token })` automatically refreshes the short-lived access token on demand.
- If a tenant revokes access in Google Security settings, backend catches `400 Invalid Grant` / `401 Unauthorized` errors safely and marks integration disabled (`sync_enabled = 0`).

---

## 5. Production Setup

In Railway, Render, Docker, or Cloudflare Workers backend environments, set:

```env
GOOGLE_OAUTH_ENABLED=
GOOGLE_CLIENT_ID=
GOOGLE_REDIRECT_URI=
GOOGLE_TOKEN_ENCRYPTION_KEY=<your-secure-32-byte-hex-or-phrase>
```

> **IMPORTANT**: In production (`NODE_ENV=production`), missing `GOOGLE_TOKEN_ENCRYPTION_KEY` triggers a fatal startup safeguard exception to prevent storing plaintext tokens.

---

## 6. Local Development Setup

For local testing:

1. Update `backend/.env`:
   ```env
   GOOGLE_OAUTH_ENABLED=
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT_URI=
   GOOGLE_TOKEN_ENCRYPTION_KEY=local-dev-secret-key-32-bytes-long!
   ```
2. In Google Cloud Console ➔ Authorized Redirect URIs, add `http://localhost:8080/api/google/callback`.
3. Start backend: `npm run dev` in `backend`.
4. Navigate to Settings ➔ Google Workspace ➔ Click `Connect Google`.
