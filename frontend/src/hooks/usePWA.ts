import { useState, useEffect } from "react";
import { subscribeSyncStatus, syncPendingSales, refreshPendingCount, SyncStatusState } from "@/lib/sync-engine";

export function usePWA() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== "undefined" ? window.navigator.onLine : true
  );
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<SyncStatusState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    lastError: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Subscribe to Sync Engine state updates
    const unsubscribeSync = subscribeSyncStatus((st) => {
      setSyncState(st);
      setIsOnline(st.isOnline);
    });

    refreshPendingCount();

    // Check display-mode standalone
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      setIsInstalled(isStandaloneMode);
    };

    checkStandalone();

    // Listeners for network connectivity status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Listeners for PWA install prompt banner triggers
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log("Orion POS: PWA successfully installed on device.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      unsubscribeSync();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.warn("Orion POS PWA: Install trigger requested, but no prompt event is deferred.");
      return false;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  };

  return {
    isOnline,
    isInstalled,
    isInstallable: deferredPrompt !== null,
    install,
    isSyncing: syncState.isSyncing,
    pendingCount: syncState.pendingCount,
    lastSyncTime: syncState.lastSyncTime,
    lastError: syncState.lastError,
    syncNow: syncPendingSales,
  };
}
