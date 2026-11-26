// IndexedDB Offline Store for Apka Bill Offline-First Engine

export interface OfflineProduct {
  id: string | number;
  name: string;
  sku: string;
  barcode?: string;
  selling_price: number;
  purchase_price: number;
  stock: number;
  gst?: number;
  category_id?: number;
  category_name?: string;
  image_url?: string;
  is_active: number;
  _scope?: string;
}

export interface OfflineCustomer {
  id: string | number;
  name: string;
  phone?: string;
  email?: string;
  loyalty_points?: number;
  total_spent?: number;
  _scope?: string;
}

export interface OfflinePendingSale {
  offlineId: string;
  invoice_number: string;
  organization_id?: string;
  store_id?: string;
  customer_id?: number;
  customer_phone?: string;
  customer_name?: string;
  cashier_name?: string;
  items: Array<{
    product_id: number;
    name: string;
    unit_price: number;
    quantity: number;
    discount?: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  payment_method: string;
  amount_paid: number;
  balance?: number;
  change_amount: number;
  created_at: string;
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError?: string;
  retryCount?: number;
}

const DB_NAME = "orion_pos_offline_db";
const DB_VERSION = 1;

const memoryStore: Record<string, Map<string, any>> = {
  products: new Map(),
  customers: new Map(),
  settings: new Map(),
  pendingSales: new Map(),
};

export function getActiveTenantScope(): string {
  if (typeof window === "undefined") return "default_default";
  const orgId = localStorage.getItem("currentOrgId") || "default";
  const storeId = localStorage.getItem("currentStoreId") || "default";
  return `${orgId}_${storeId}`;
}

function getActiveStoreIdStr(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("currentStoreId") || "";
}

function getActiveOrgIdStr(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("currentOrgId") || "";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("customers")) {
        db.createObjectStore("customers", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("pendingSales")) {
        const salesStore = db.createObjectStore("pendingSales", { keyPath: "offlineId" });
        salesStore.createIndex("syncStatus", "syncStatus", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Clear non-queued tenant caches on logout or account switch
export async function clearOfflineTenantCaches(includePendingSales: boolean = false): Promise<void> {
  memoryStore.products.clear();
  memoryStore.customers.clear();
  memoryStore.settings.clear();
  if (includePendingSales) memoryStore.pendingSales.clear();

  try {
    const db = await openDB();
    const storesToClear = includePendingSales
      ? ["products", "customers", "settings", "pendingSales"]
      : ["products", "customers", "settings"];
    const tx = db.transaction(storesToClear, "readwrite");
    for (const storeName of storesToClear) {
      tx.objectStore(storeName).clear();
    }
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn("Failed to clear offline caches:", err);
  }
}

// 1. PRODUCTS CACHE (Tenant & Store Scoped)
export async function saveProductsOffline(products: OfflineProduct[]): Promise<void> {
  const scope = getActiveTenantScope();
  try {
    const db = await openDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    // Remove only stale records for the current scope so other stores keep their offline cache
    await new Promise<void>((resolve) => {
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          if (!cursor.value._scope || cursor.value._scope === scope) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    });
    for (const p of products) {
      store.put({ ...p, _scope: scope });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to cache products offline:", err);
  }
}

export async function getProductsOffline(): Promise<OfflineProduct[]> {
  const scope = getActiveTenantScope();
  try {
    const db = await openDB();
    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as OfflineProduct[];
        resolve(all.filter((p) => p._scope === scope));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to read products from offline DB:", err);
    return [];
  }
}

// 2. CUSTOMERS CACHE (Tenant & Store Scoped)
export async function saveCustomersOffline(customers: OfflineCustomer[]): Promise<void> {
  const scope = getActiveTenantScope();
  try {
    const db = await openDB();
    const tx = db.transaction("customers", "readwrite");
    const store = tx.objectStore("customers");
    await new Promise<void>((resolve) => {
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          if (!cursor.value._scope || cursor.value._scope === scope) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    });
    for (const c of customers) {
      store.put({ ...c, _scope: scope });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to cache customers offline:", err);
  }
}

export async function getCustomersOffline(): Promise<OfflineCustomer[]> {
  const scope = getActiveTenantScope();
  try {
    const db = await openDB();
    const tx = db.transaction("customers", "readonly");
    const store = tx.objectStore("customers");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as OfflineCustomer[];
        resolve(all.filter((c) => c._scope === scope));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to read customers from offline DB:", err);
    return [];
  }
}

// 3. SETTINGS CACHE (Strictly Scoped per Store)
export async function saveSettingsOffline(settingsObj: Record<string, string>): Promise<void> {
  const scope = getActiveTenantScope();
  const prefix = `${scope}::`;
  try {
    const db = await openDB();
    const tx = db.transaction("settings", "readwrite");
    const store = tx.objectStore("settings");
    for (const [key, value] of Object.entries(settingsObj)) {
      store.put({ key: `${prefix}${key}`, value: String(value ?? ""), _scope: scope });
    }
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn("Failed to cache settings offline:", err);
  }
}

export async function getSettingsOffline(): Promise<Record<string, string>> {
  const scope = getActiveTenantScope();
  const prefix = `${scope}::`;
  try {
    const db = await openDB();
    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const result: Record<string, string> = {};
        for (const item of req.result || []) {
          if (typeof item.key === "string" && item.key.startsWith(prefix)) {
            result[item.key.slice(prefix.length)] = item.value;
          }
        }
        resolve(result);
      };
      req.onerror = () => resolve({});
    });
  } catch (err) {
    return {};
  }
}

// 4. OFFLINE SALES QUEUE (Tagged with Org + Store to Prevent Cross-Store Leakage)
export async function queueOfflineSale(sale: OfflinePendingSale): Promise<void> {
  const stampedSale: OfflinePendingSale = {
    ...sale,
    organization_id: sale.organization_id || getActiveOrgIdStr(),
    store_id: sale.store_id || getActiveStoreIdStr(),
  };
  try {
    const db = await openDB();
    const tx = db.transaction(["pendingSales", "products"], "readwrite");
    const salesStore = tx.objectStore("pendingSales");
    const prodStore = tx.objectStore("products");

    salesStore.put(stampedSale);

    for (const item of stampedSale.items) {
      const getReq = prodStore.get(item.product_id);
      getReq.onsuccess = () => {
        const prod = getReq.result;
        if (prod) {
          prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
          prodStore.put(prod);
        }
      };
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    memoryStore.pendingSales.set(stampedSale.offlineId, stampedSale);
  }
}

export async function getPendingSalesOffline(): Promise<OfflinePendingSale[]> {
  const activeOrgId = getActiveOrgIdStr();
  const activeStoreId = getActiveStoreIdStr();

  const matchesTenant = (s: OfflinePendingSale) => {
    if (s.syncStatus === "synced") return false;
    if (activeOrgId && s.organization_id && String(s.organization_id) !== String(activeOrgId)) {
      return false;
    }
    if (activeStoreId && s.store_id && String(s.store_id) !== String(activeStoreId)) {
      return false;
    }
    return true;
  };

  try {
    const db = await openDB();
    const tx = db.transaction("pendingSales", "readonly");
    const store = tx.objectStore("pendingSales");
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(((req.result || []) as OfflinePendingSale[]).filter(matchesTenant));
      req.onerror = () =>
        resolve(Array.from(memoryStore.pendingSales.values()).filter(matchesTenant));
    });
  } catch (err) {
    return Array.from(memoryStore.pendingSales.values()).filter(matchesTenant);
  }
}

export async function getPendingSalesCountOffline(): Promise<number> {
  const sales = await getPendingSalesOffline();
  return sales.length;
}

export async function updatePendingSaleStatus(
  offlineId: string,
  status: "pending" | "syncing" | "synced" | "error",
  syncError?: string,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("pendingSales", "readwrite");
  const store = tx.objectStore("pendingSales");

  const getReq = store.get(offlineId);
  getReq.onsuccess = () => {
    const item = getReq.result;
    if (item) {
      if (status === "synced") {
        store.delete(offlineId);
      } else {
        item.syncStatus = status;
        if (syncError) item.syncError = syncError;
        if (status === "error") item.retryCount = (item.retryCount || 0) + 1;
        store.put(item);
      }
    }
  };

  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
