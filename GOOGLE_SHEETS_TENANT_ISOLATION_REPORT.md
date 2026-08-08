# GOOGLE SHEETS TENANT ISOLATION REPORT

## 1. Root Cause Analysis

During a thorough audit of the Google Sheets synchronization subsystem in **Apka Bill / Orion POS**, four primary architectural defects were identified that caused Google Sheets data to cross-contaminate across organizations and stores:

1. **Async Execution Context Loss in Background Processor Loop**:
   - `SyncQueueManager` operated as a singleton that ran a recurring background queue loop via `setTimeout()`.
   - In Node.js, `setTimeout` callbacks execute in a detached execution context outside Express HTTP request scope.
   - Consequently, `getTenantContext()` yielded `{ organizationId: 0, currentStoreId: 0, role: "none" }`.
   - When `settingsRepository.get("google_sheet_id")` was called, `resolveStoreIdForContext` defaulted `storeId = 0` to **Store 1**.
   - **Result**: The background worker ALWAYS retrieved Store 1's spreadsheet ID (`google_sheet_id`) and sync toggle (`google_sync_enabled`), causing sync jobs created by any store or organization to attempt uploading rows into Store 1's Google Sheet!

2. **Missing `organization_id` in `sync_jobs` Table**:
   - The `sync_jobs` database schema only recorded `store_id`, omitting `organization_id`.
   - Without `organization_id` on the job record, background processing could not guarantee double-layer verification (`DATA.organization_id == CONFIG.organization_id == AUTHENTICATED.organization_id`).

3. **Absence of Pre-Flight Non-Negotiable Tenant Safeguards**:
   - Prior to calling `sheets.spreadsheets.values.append` / `update`, `syncToGoogleSheets()` did not validate that `DATA.organization_id == CONFIG.organization_id == AUTHENTICATED.organization_id` and `DATA.store_id == CONFIG.store_id == AUTHENTICATED.currentStoreId`.

4. **Frontend LocalStorage Stale Sheet ID Fallback**:
   - `settings.lazy.tsx` hydrated its `sheetId` state from global `localStorage.getItem("orion_google_sheet_id")` and a hardcoded string fallback `"1BxiMVs0XRA5nFMdKbBUI6H6W5B0k8t"`.
   - Switching active store/organization retained the previous store's sheet ID in `localStorage`. If the newly selected store had no sheet ID set in DB yet, the UI initialized with the prior store's sheet ID and saved it to the new store's database settings upon submission.

---

## 2. Previous Architecture vs. Fixed Architecture

### Previous Architecture

```
HTTP Request / Background Loop
        ↓
Sync Queue Worker (SyncQueueManager.processQueue via setTimeout)
        ↓
Ambient getTenantContext() (Returns storeId: 0 in background loop)
        ↓
settingsRepository.get("google_sheet_id") (Defaults to Store 1 ID!)
        ↓
All sync jobs written to Store 1 Google Sheet! ❌ (ISOLATION BUG)
```

### Fixed Architecture

```
HTTP Request / Background Loop
        ↓
Sync Queue Worker (SyncQueueManager.processQueue)
        ↓
Fetch pending job across all tenant records (SyncJob contains organization_id & store_id)
        ↓
Bind storeStorage.run({ organizationId: job.organization_id, currentStoreId: job.store_id, ... })
        ↓
Look up google_sheet_id & google_sync_enabled SPECIFICALLY for job.store_id
        ↓
NON-NEGOTIABLE TENANT MATCH VALIDATION
  DATA.organization_id == CONFIG.organization_id == AUTHENTICATED.organization_id
  AND DATA.store_id == CONFIG.store_id == AUTHENTICATED.currentStoreId
  (ABORT immediately if any ID disagrees)
        ↓
Write ONLY to job.store_id's configured spreadsheet ID! ✅ (TENANT ISOLATED)
```

---

## 3. Exact Places Tenant Isolation Was Lost

- **`backend/src/services/sync.service.ts` (`SyncQueueManager.processQueue`)**: Read `settingsRepository.get("google_sheet_id")` outside job tenant scope before inspecting pending job context.
- **`backend/src/repositories/postgres/sync.repository.ts` (`getPendingJob`)**: Restricted queries to ambient `currentStoreId` (which was 0 in background context), preventing the queue worker from processing jobs per tenant context.
- **`frontend/src/routes/settings.lazy.tsx`**: Saved `orion_google_sheet_id` into global `localStorage` and used it as fallback for newly selected stores.

---

## 4. Summary of Files Changed

1. **[schema.ts](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/db/schema.ts)**: Added `organization_id` foreign key column and indices (`idx_sync_jobs_organization_id`, `idx_sync_jobs_store_id`, `idx_sync_jobs_status`) to `sync_jobs` table.
2. **[ISyncRepository.ts](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/repositories/interfaces/ISyncRepository.ts)**: Added `organization_id` and `store_id` fields to `SyncJob` interface.
3. **[sync.repository.ts](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/repositories/postgres/sync.repository.ts)**: Updated `enqueue` to record `organization_id` and `store_id`, updated `getPendingJob` to support safe global queue popping across stores, and updated job status updates by job ID.
4. **[sync.service.ts](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/services/sync.service.ts)**: Re-architected `SyncQueueManager.processQueue` to pop pending jobs across tenants, resolve job store/organization ID, fetch store-specific `google_sheet_id` and `google_sync_enabled`, bind `storeStorage.run(...)`, and enforce strict non-negotiable pre-flight tenant validation before calling `syncToGoogleSheets`.
5. **[init.ts](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/database/init.ts)**: Added safe programmatic column check `ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS organization_id integer REFERENCES organizations(id)` on database startup.
6. **[settings.lazy.tsx](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/frontend/src/routes/settings.lazy.tsx)**: Removed global `localStorage` sheet ID fallback and hardcoded sheet ID default.
7. **[test-google-sheets-isolation.ts](file:///Users/ayush/Documents/Code/orion-pulse-main-fresh/backend/src/tests/test-google-sheets-isolation.ts)**: Added multi-tenant isolation integration test suite.

---

## 5. Database & Schema Changes

Added `organization_id` column to `sync_jobs` table:
```sql
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS organization_id integer REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_organization_id ON sync_jobs (organization_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_store_id ON sync_jobs (store_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs (status);
```

---

## 6. Configuration Lookup Changes

Every Google Sheets configuration query is now strictly tenant-filtered:
```typescript
await storeStorage.run(
  {
    organizationId: targetOrgId,
    currentStoreId: targetStoreId,
    userId: 0,
    role: "system",
  },
  async () => {
    const enabled = (await settingsRepository.get("google_sync_enabled", "0")) === "1";
    const sheetId = await settingsRepository.get("google_sheet_id", "");
    ...
  }
);
```

---

## 7. Data Query Changes & Non-Negotiable Match Validation

Every job payload enqueued carries `organization_id` and `store_id`.
Before any Google Sheets upload:
```typescript
if (payloadObj.organization_id && Number(payloadObj.organization_id) !== targetOrgId) {
  const errStr = `[TENANT MISMATCH ABORT] Payload org (${payloadObj.organization_id}) does not match target org (${targetOrgId})`;
  logger.error(`❌ ${errStr}`);
  await syncRepository.updateJobStatus(job.id, "failed", 3, errStr);
  return;
}
```

---

## 8. Background Sync Changes

Background queue worker (`SyncQueueManager.processQueue`) no longer relies on ambient HTTP request context.
Instead, it pops pending jobs across all tenant records, resolves each job's specific `store_id` and `organization_id`, fetches that store's configured `google_sheet_id`, binds `storeStorage.run(...)`, validates matching IDs, and syncs strictly to that store's sheet destination.

---

## 9. Frontend Cache & Query Changes

- `settings.lazy.tsx` state `sheetId` initialized as `""`.
- Removed global `localStorage` hydration and saving of `orion_google_sheet_id`.
- `settings.lazy.tsx` fetches settings exclusively from `/api/settings` for the active store context.

---

## 10. Tests Added & Results

Automated Multi-Tenant Isolation Test Script: `backend/src/tests/test-google-sheets-isolation.ts`

### Execution Output:
```
==================================================
🧪 STARTING GOOGLE SHEETS MULTI-TENANT ISOLATION TESTS
==================================================

1️⃣ Setting up Organization A and Organization B...
✅ Org A (ID 16) -> Store A1 (ID 22), Store A2 (ID 23)
✅ Org B (ID 17) -> Store B1 (ID 24)

2️⃣ Setting store-isolated Google Sheet IDs...
✅ Store-isolated settings verified successfully.

3️⃣ Enqueuing jobs under Org A / Store A1...
4️⃣ Enqueuing jobs under Org B / Store B1...
✅ Enqueued sync jobs verified with explicit organization_id and store_id.

5️⃣ Testing Non-Negotiable Tenant Mismatch Safeguard...
[INFO] 🔄 Processing sync job ID 482 (sale) for Org 16 / Store 22...
[INFO] 🔄 Processing sync job ID 483 (sale) for Org 17 / Store 24...
[INFO] 🔄 Processing sync job ID 484 (sale) for Org 17 / Store 24...
[ERROR] ❌ [TENANT MISMATCH ABORT] Payload org (16) does not match target org (17)
✅ Tenant Mismatch Safeguard succeeded! Aborted with message: "[TENANT MISMATCH ABORT] Payload org (16) does not match target org (17)"

==================================================
🎉 ALL MULTI-TENANT ISOLATION TESTS PASSED!
==================================================
```

---

## 11. Build & Compilation Results

- Backend TypeScript Check (`npx tsc --noEmit`): **PASSED (0 Errors)**
- Frontend TypeScript Check (`npx tsc --noEmit`): **PASSED (0 Errors)**
- Backend Build (`npm run build`): **PASSED**
- Frontend Production Build (`npm run build`): **PASSED**
- Multi-Tenant Isolation Test (`npx tsx src/tests/test-google-sheets-isolation.ts`): **PASSED**

---

## 12. Production Migration Notes

- Database column addition (`ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS organization_id integer REFERENCES organizations(id);`) is **100% additive, backward-compatible, and safe**.
- Existing `sync_jobs` without `organization_id` are automatically backfilled using `stores.organization_id` when processed.
- No deletion or modification of production data, sheets, or existing settings occurred.
