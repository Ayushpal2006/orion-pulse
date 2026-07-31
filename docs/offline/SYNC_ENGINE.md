# APKA BILL V2: BACKGROUND SYNC ENGINE & RECOVERY

---

## 1. AUTOMATIC BACKGROUND RECOVERY

When internet connectivity is restored:
1. `SyncEngine` detects network online event via `window.addEventListener("online")`.
2. Triggers `syncPendingSales()` background worker.
3. Iterates over pending IndexedDB records ordered by `created_at` timestamp.
4. Sends payload with idempotent `offlineIdentifier`.
5. Upon 200 OK server response, marks record `syncStatus: "synced"`.

---

## 2. IDEMPOTENCY & DUPLICATE SALE PROTECTION

Every offline sale contains a unique client-generated UUID `offlineId` (`OFF-{timestamp}-{hash}`).
The backend database verifies:

```ts
const existing = await db.query.sales.findFirst({
  where: eq(sales.offline_identifier, payload.offlineId)
});
if (existing) return existing; // Safe idempotent return
```

This guarantees zero duplicate sales even if network drops during HTTP request delivery.
