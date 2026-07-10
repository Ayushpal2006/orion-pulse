# Release Checklist — Orion POS (Release Candidate 1)

This checklist tracks tasks required to deploy Orion POS Release Candidate 1 (RC1) safely to production.

## 📋 Release Readiness Status

- [x] **Dependencies Checklist**: Verify `qrcode` package is installed on the server backend.
- [x] **Workspace Verification**: Backend build (`npm --prefix backend run build`) completed successfully.
- [x] **Workspace Verification**: Frontend build (`npm run build`) completed successfully.
- [x] **Workspace Verification**: Shared datetime smoke test passed for UTC and Asia/Kolkata formatting.
- [x] **Database Optimization**: Ensure all index migrations are created and validated during DB bootstrap (`init.ts`).
- [x] **Timezone Settings**: Standardize date string parsing to prevent local machine clock shifts from altering UTC/IST.
- [x] **Storage Policy**: Confirm background cleanup triggers daily at 2:00 AM Kolkata time.
- [x] **Interception Middleware**: Verify dynamic PDF regeneration handles deleted/cleaned invoice files.
- [x] **Backup & Restore**: Test database snapshot downloads and file restore functionality.
- [x] **Google Sheets Sync**: Confirm status queues, pending metrics, and manual triggers work.

## 🚀 Pre-Deployment Checklists

### 1. Database Migrations
- Ensure backup of the production database is taken prior to upgrade:
  `cp database/orion.db database/orion_pre_rc1.db`
- Boot the POS application server. It will automatically run the migrations inside `init.ts`, seeding new indexes (`idx_products_name`, `idx_customers_phone`, etc.) and default configuration keys.

### 2. Environment Variables Configuration
Ensure the following variables are set on the hosting environment:
```env
PORT=8080
GOOGLE_CLIENT_EMAIL=your-service-account@iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 3. Compilation & Build Tests
- Build Backend:
  ```bash
  cd backend
  npm run build
  ```
- Build Frontend:
  ```bash
  npm run build
  ```

## 🔍 Post-Deployment Verification Steps

1. **Verify API Health Check**:
   Navigate to `http://localhost:8080/` and verify status code is `200` with payload `{"status":"ok"}`.
2. **Verify Backup Download**:
   Go to Settings -> Backup & Restore -> Backup. Confirm the `.db` file downloads successfully.
3. **Verify UPI checkout QR**:
   Add item -> Checkout via UPI -> Confirm A4 PDF displays the logo and QR code clearly.
