// IndexedDB Offline Store for Orion POS Offline-First Engine

export interface OfflineProduct {
  id: string | number;
  name: string;
  sku: string;
  barcode?: string;
  selling_price: number;
  purchase_price: number;
  stock: number;
  category_id?: number;
  category_name?: string;
  image_url?: string;
  is_active: number;
}

export interface OfflineCustomer {
  id: string | number;
  name: string;
  phone?: string;
  email?: string;
  loyalty_points?: number;
  total_spent?: number;
}

export interface OfflinePendingSale {
  offlineId: string;
  invoice_number: string;
  customer_id?: number;
  customer_name?: string;
  items: Array<{
    product_id: number;
    name: string;
    unit_price: number;
    quantity: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  payment_method: string;
  amount_paid: number;
  change_amount: number;
  created_at: string;
  syncStatus: "pending" | "syncing" | "synced" | "error";
  syncError?: string;
}

const DB_NAME = "orion_pos_offline_db";
const DB_VERSION = 1;

const memoryStore: Record<string, Map<string, any>> = {
  products: new Map(),
  customers: new Map(),
  settings: new Map(),
  pendingSales: new Map(),
};

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

// 1. PRODUCTS CACHE
export async function saveProductsOffline(products: OfflineProduct[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    await new Promise<void>((resolve, reject) => {
      store.clear().onsuccess = () => resolve();
    });
    for (const p of products) {
      store.put(p);
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
  try {
    const db = await openDB();
    const tx = db.transaction("products", "readonly");
    const store = tx.objectStore("products");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to read products from offline DB:", err);
    return [];
  }
}

// 2. CUSTOMERS CACHE
export async function saveCustomersOffline(customers: OfflineCustomer[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("customers", "readwrite");
    const store = tx.objectStore("customers");
    for (const c of customers) {
      store.put(c);
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
  try {
    const db = await openDB();
    const tx = db.transaction("customers", "readonly");
    const store = tx.objectStore("customers");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to read customers from offline DB:", err);
    return [];
  }
}

// 3. SETTINGS CACHE
export async function saveSettingsOffline(settingsObj: Record<string, string>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("settings", "readwrite");
    const store = tx.objectStore("settings");
    for (const [key, value] of Object.entries(settingsObj)) {
      store.put({ key, value: String(value ?? "") });
    }
  } catch (err) {
    console.warn("Failed to cache settings offline:", err);
  }
}

export async function getSettingsOffline(): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const result: Record<string, string> = {};
        for (const item of req.result || []) {
          result[item.key] = item.value;
        }
        resolve(result);
      };
      req.onerror = () => resolve({});
    });
  } catch (err) {
    return {};
  }
}

// 4. OFFLINE SALES QUEUE
export async function queueOfflineSale(sale: OfflinePendingSale): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(["pendingSales", "products"], "readwrite");
    const salesStore = tx.objectStore("pendingSales");
    const prodStore = tx.objectStore("products");

    salesStore.put(sale);

    for (const item of sale.items) {
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
    memoryStore.pendingSales.set(sale.offlineId, sale);
  }
}

export async function getPendingSalesOffline(): Promise<OfflinePendingSale[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("pendingSales", "readonly");
    const store = tx.objectStore("pendingSales");
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).filter((s) => s.syncStatus !== "synced"));
      req.onerror = () => resolve(Array.from(memoryStore.pendingSales.values()).filter((s) => s.syncStatus !== "synced"));
    });
  } catch (err) {
    return Array.from(memoryStore.pendingSales.values()).filter((s) => s.syncStatus !== "synced");
  }
}

export async function getPendingSalesCountOffline(): Promise<number> {
  const sales = await getPendingSalesOffline();
  return sales.length;
}

export async function updatePendingSaleStatus(offlineId: string, status: "pending" | "syncing" | "synced" | "error", syncError?: string): Promise<void> {
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
        store.put(item);
      }
    }
  };

  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
