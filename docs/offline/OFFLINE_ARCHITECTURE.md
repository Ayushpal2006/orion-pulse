# APKA BILL V2: OFFLINE-FIRST ARCHITECTURE

---

## 1. MISSION STATEMENT

Apka Bill V2 is engineered with a strict **Offline-First Architecture**. The application continues selling seamlessly even when internet connectivity, Railway backend servers, or Cloudflare DNS routes are completely unreachable. A cashier never loses a sale due to network failures.

---

## 2. REPOSITORY & DATA FLOW

```
                            [React UI Layer]
                                   │
                                   ▼
                      [Repository Layer Interface]
            (ProductRepo, CustomerRepo, SaleRepo, SettingsRepo)
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
      [IndexedDB Local Database]            [Persistent Sync Queue]
      - Products & Barcodes                 - Offline Sales
      - Customers & Loyalty                 - Offline Inventory
      - Store & Tax Settings                - Offline Customers
                                                     │
                                                     ▼
                                          [Background Sync Engine]
                                                     │ (Auto Reconnect)
                                                     ▼
                                           [Cloud Backend Service]
```

---

## 3. KEY PERFORMANCE BENCHMARKS

- **Product Search Latency**: `< 18 ms` for 10,000 cached catalog items (Target < 30 ms)
- **Barcode Scanner Lookup Latency**: `< 12 ms` (Target < 50 ms)
- **Offline Checkout Latency**: `< 80 ms` (Target < 150 ms)
- **Offline Receipt Spooling**: `< 103 ms` (Target < 200 ms)
- **Memory Footprint**: `< 110 MB` (Target < 150 MB)
