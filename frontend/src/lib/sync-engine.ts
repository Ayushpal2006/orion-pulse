import { getPendingSalesOffline, updatePendingSaleStatus } from "./offline-db";
import { buildCheckoutPayloadFromOfflineSale } from "./offline-checkout-mapper";
import { apiFetch, API_BASE_URL } from "./api";
import { toast } from "sonner";

export { buildCheckoutPayloadFromOfflineSale };

export interface SyncStatusState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
}

let isSyncingActive = false;
let statusListeners: Array<(status: SyncStatusState) => void> = [];

let currentSyncState: SyncStatusState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  lastError: null,
};

export function subscribeSyncStatus(listener: (status: SyncStatusState) => void): () => void {
  statusListeners.push(listener);
  listener(currentSyncState);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

function updateSyncState(partial: Partial<SyncStatusState>): void {
  currentSyncState = { ...currentSyncState, ...partial };
  for (const listener of statusListeners) {
    listener(currentSyncState);
  }
}

export async function refreshPendingCount(): Promise<number> {
  const pending = await getPendingSalesOffline();
  updateSyncState({
    pendingCount: pending.length,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  });
  return pending.length;
}

export async function syncPendingSales(): Promise<{ successCount: number; failedCount: number }> {
  if (isSyncingActive || (typeof navigator !== "undefined" && !navigator.onLine)) {
    const pending = await getPendingSalesOffline();
    updateSyncState({
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      pendingCount: pending.length,
    });
    return { successCount: 0, failedCount: 0 };
  }

  isSyncingActive = true;
  updateSyncState({ isSyncing: true, lastError: null });

  let successCount = 0;
  let failedCount = 0;

  try {
    const pendingSales = await getPendingSalesOffline();
    updateSyncState({ pendingCount: pendingSales.length });

    if (pendingSales.length === 0) {
      updateSyncState({ isSyncing: false, lastSyncTime: new Date().toLocaleTimeString() });
      isSyncingActive = false;
      return { successCount: 0, failedCount: 0 };
    }

    console.log(
      `[Sync Engine] Found ${pendingSales.length} pending offline sales. Initiating sync...`,
    );

    const activeStoreId =
      typeof window !== "undefined" ? localStorage.getItem("currentStoreId") || "" : "";

    for (const sale of pendingSales) {
      // Never cross-sync a bill queued in another store
      if (sale.store_id && activeStoreId && String(sale.store_id) !== String(activeStoreId)) {
        continue;
      }

      await updatePendingSaleStatus(sale.offlineId, "syncing");
      try {
        const payload = buildCheckoutPayloadFromOfflineSale(sale);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Offline-Id": sale.offlineId,
        };
        if (sale.store_id) {
          headers["X-Store-Id"] = String(sale.store_id);
        }

        const res = await apiFetch(`${API_BASE_URL}/checkout`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          await updatePendingSaleStatus(sale.offlineId, "synced");
          successCount++;
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || errData.message || `HTTP ${res.status}`;
          await updatePendingSaleStatus(sale.offlineId, "error", errMsg);
          failedCount++;
        }
      } catch (err: any) {
        console.warn(`[Sync Engine] Sale ${sale.offlineId} sync failed:`, err);
        await updatePendingSaleStatus(sale.offlineId, "error", err.message || "Network error");
        failedCount++;
      }
    }

    const remaining = await getPendingSalesOffline();
    updateSyncState({
      isSyncing: false,
      pendingCount: remaining.length,
      lastSyncTime: new Date().toLocaleTimeString(),
      lastError: failedCount > 0 ? `${failedCount} sales failed to sync` : null,
    });

    if (successCount > 0) {
      toast.success(`Synced ${successCount} offline sale(s) successfully!`);
    }
  } catch (globalErr: any) {
    console.error("[Sync Engine] Global sync error:", globalErr);
    updateSyncState({ isSyncing: false, lastError: globalErr.message });
  } finally {
    isSyncingActive = false;
  }

  return { successCount, failedCount };
}

// Auto-sync listener on window reconnect
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[Sync Engine] Connection restored! Triggering auto-sync...");
    updateSyncState({ isOnline: true });
    toast.info("Internet restored. Syncing pending offline sales...");
    syncPendingSales();
  });

  window.addEventListener("offline", () => {
    console.log("[Sync Engine] Network disconnected. Switched to Offline mode.");
    updateSyncState({ isOnline: false });
    toast.warning("Offline mode active. Sales will be saved locally and synced later.");
  });
}
