# APKA BILL V2: DEVICE MANAGER & HARDWARE PROFILES

---

## 1. DEVICE PROFILES

Stores can configure and persist specific hardware profiles scoped per Organization and Store:

```ts
export interface StoreDeviceProfile {
  storeId: number;
  profileName: "Counter Printer" | "Kitchen KOT" | "Warehouse Printer";
  printerType: "browser" | "usb" | "bluetooth" | "network" | "pos";
  paperWidth: "58mm" | "80mm" | "A4";
  autoCut: boolean;
  drawerPulse: boolean;
}
```

---

## 2. CONFIGURATION ISOLATION

Device profiles persist in IndexedDB and LocalStorage per Store ID, ensuring zero hardware configuration leakage across multi-tenant stores or organizations.
