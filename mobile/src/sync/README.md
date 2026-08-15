# Apka Bill Mobile — Synchronization Layer

## 1. Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│                 React Native Mobile Application             │
│  - SyncService (Concurrency Lock, Delta Ingestion)          │
│  - SyncStateManager (Reactive in-memory + SQLite backing)    │
│  - HomeScreen / UI (Sync Badges, Progress, Manual Trigger)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP REST (JSON)
                               │ Authorization: Bearer <JWT>
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Existing Express Backend                  │
│  - GET /api/sync/download?lastSyncTime=<ISO_TIMESTAMP>      │
│  - GET /api/stores/current                                  │
│  - GET /api/products                                        │
│  - GET /api/customers                                       │
│  - GET /api/settings                                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Drizzle ORM
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Neon PostgreSQL Database                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Synchronization Mechanisms

### A. Initial Sync
- When `lastSyncAt` is empty or `forceFull: true` is requested:
- Calls `GET /api/sync/download` without `lastSyncTime`.
- Retrieves all products, customers, store metadata, and settings for the authenticated `store_id`.
- Performs atomic batch upserts into local SQLite.
- Records `lastSyncAt = syncTime` in `__sync_state` upon commit.

### B. Incremental Sync
- When `lastSyncAt` is present:
- Calls `GET /api/sync/download?lastSyncTime=${lastSyncAt}`.
- Backend filters records where `updated_at > lastSyncTime`.
- Mobile client applies delta updates to local SQLite without re-fetching unmodified rows.
- Advances `lastSyncAt` to the new `serverSyncTime`.

### C. Concurrency Safety
- `SyncService` maintains an internal lock (`activeSyncPromise`).
- If a second sync is requested while a sync is in progress, the active promise is returned, preventing parallel race conditions or duplicate writes.

### D. Failure & Offline Tolerance
- If the network drops or backend is unreachable, existing local SQLite data is **never deleted**.
- `lastSyncAt` marker is not advanced if the sync fails halfway through.
