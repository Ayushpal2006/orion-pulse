# Apka Bill Mobile — SQLite Local Database Layer

## 1. Package Chosen
- **Package**: `react-native-sqlite-storage`
- **Why Chosen**: Industry standard, battle-tested native SQLite engine for Android and iOS with native C/Java bindings. Supports full ACID transactions, WAL (Write-Ahead Logging) mode, parameterized queries, and full TypeScript typing.
- **Android Compatibility**: Fully compatible with Android API 24+ (Android 7.0 to Android 15), supporting 32-bit and 64-bit architectures (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`).
- **TypeScript Support**: Full typing provided via `@types/react-native-sqlite-storage` and custom repository interfaces.

---

## 2. Architecture & Directory Structure
```
mobile/src/db/
├── database.ts                   # SQLite connection manager, WAL config, transaction runner
├── types.ts                      # Local entity types (LocalStore, LocalProduct, LocalCustomer)
├── index.ts                      # Barrel export
├── migrations/
│   ├── 001_initial_schema.ts    # Initial schema with stores, products, customers & search indexes
│   └── index.ts                  # Idempotent migration runner & version tracker
└── repositories/
    ├── product.repository.ts     # Offline product search, barcode/SKU lookup, batch upsert
    ├── customer.repository.ts    # Offline customer search, phone lookup, batch upsert
    ├── store.repository.ts       # Store metadata persistence
    └── index.ts                  # Barrel export
```

---

## 3. Schema Definitions & Pragmas
- **WAL Mode**: `PRAGMA journal_mode = WAL;` enables concurrent reads during database writes.
- **Synchronous**: `PRAGMA synchronous = NORMAL;` optimizes disk I/O for POS operations while retaining power-loss safety.
- **Foreign Keys**: `PRAGMA foreign_keys = ON;` enforces relational integrity.

### Tables:
- **`stores`**: Server ID, Organization ID, Store Name, Code, Address, Phone, GST Number, Timestamps.
- **`products`**: Server ID, Store ID, Name, SKU, Barcode, Category, Selling Price, Purchase Price, Stock, Min Stock, GST, Active Status, Image URL.
- **`customers`**: Server ID, Store ID, Name, Phone, Email, Address, Notes, Total Orders, Lifetime Value.
- **`__migrations`**: Migration ID, Name, Applied At timestamp.

---

## 4. Safety Guarantees
- **No `DROP TABLE` on startup**: Migrations execute idempotently using `CREATE TABLE IF NOT EXISTS`.
- **No data loss on empty API response**: If the backend returns empty or network fails, previously cached SQLite data is preserved.
- **Transaction Safety**: Batch operations run inside single ACID transactions to guarantee all-or-nothing writes.
