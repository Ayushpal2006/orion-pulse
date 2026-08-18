# PRODUCTION BUG AUDIT & ROOT CAUSE ANALYSIS — APKA BILL MOBILE

> **Document Status**: COMPREHENSIVE PRODUCTION BUG AUDIT & ROOT CAUSE TRACE  
> **Workspace**: `/orion-pulse-main-fresh/docs/PRODUCTION_BUG_AUDIT.md`  
> **Target Application**: `mobile-expo/`  
> **Rule**: DO NOT GUESS. All fixes are verified against active source code trace.

---

## BUG 1: Local Data Disappearing on App Restart / Update / Bootstrap

* **Reported Symptom**: Previously existing products, customers, sales, and settings sometimes disappear automatically after an app update, restart, or session bootstrap.
* **Root Cause**:
  1. In `AuthContext.tsx` (`initAuth` method), when the server returned a 401 Unauthorized or network error, `logout()` was called unconditionally in certain exception handlers, clearing stored auth session keys and resetting store context without distinguishing between temporary offline status and invalid credentials.
  2. Database singleton initialization in `db.ts` and `migration.ts` lacked defensive WAL checkpointing and explicit pragma journal configuration on app startup, causing uncommitted WAL frames to be discarded if the process was force-closed during an active write.
* **Files**:
  - `mobile-expo/src/context/AuthContext.tsx`
  - `mobile-expo/src/database/db.ts`
  - `mobile-expo/src/database/migration.ts`
  - `mobile-expo/src/services/api/client.ts`
* **Current Flow**:
  - App opens -> `initAuth` checks session -> If token check fails/offline error -> calls `logout()` -> session wiped -> user forced back to login screen.
* **Fix**:
  1. Update `AuthContext.tsx` `initAuth`: Only log out when the backend explicitly returns HTTP 401 Unauthorized. Network errors (0, 502, timeout) preserve offline session state from `SecureStore`.
  2. Update `db.ts`: Enforce `PRAGMA journal_mode = WAL;` and `PRAGMA wal_checkpoint(FULL);` during startup to flush WAL frames safely to disk.
  3. Ensure database name `orion_pos.db` remains strictly uniform across all connection code paths.
* **Test**:
  - Insert product, customer, sale, and settings -> Force-close app -> Reopen app -> Verify 100% data intact offline.

---

## BUG 2: Organization / Store Settings Leaking Across Stores

* **Reported Symptom**: Settings from different stores or organizations appear mixed or overwrite each other when switching accounts or stores.
* **Root Cause**:
  - The SQLite `store_settings` table uses global string keys (`storeName`, `phone`, `address`, `gstin`) with `key` as the primary key.
  - When switching stores, settings were stored globally without tenant/store scoping (`store_{store_id}_{key}`), causing Store B to overwrite Store A's settings in SQLite.
* **Files**:
  - `mobile-expo/src/database/schema.ts`
  - `mobile-expo/src/database/repositories/settings.repository.ts`
  - `mobile-expo/src/screens/SettingsScreen.tsx`
  - `mobile-expo/src/context/AuthContext.tsx`
* **Current Flow**:
  - Login Store A -> Set `storeName = "Shop A"` -> Logout -> Login Store B -> Set `storeName = "Shop B"` -> Local SQLite updates key `storeName` -> Login Store A -> Displays `storeName = "Shop B"`.
* **Fix**:
  1. Scope all `store_settings` SQL reads and writes with active `store_id` (e.g. `store_${store_id}_${key}` or tenant-scoped store_settings table).
  2. On user login / store switch, rehydrate settings cleanly for the active store context from API / SQLite.
* **Test**:
  - Login Store A (Set Shop A, Phone 1111111111) -> Login Store B (Set Shop B, Phone 2222222222) -> Switch back to Store A -> Verify Shop A & Phone 1111111111 preserved with zero leakage.

---

## BUG 3: Receipt Printing Missing Purchased Line Items

* **Reported Symptom**: Receipt prints store header, invoice number, and grand total, but purchased line items are missing from the printout.
* **Root Cause**:
  - In `BillingScreen.tsx`, after checkout completed, `PrinterService.printReceipt` was called with an incomplete skeleton payload `{ invoiceNumber, storeName }` omitting the `items` array and breakdown fields.
  - `ReceiptFormatter.ts` received 0 items, rendering an empty line-item section.
* **Files**:
  - `mobile-expo/src/screens/BillingScreen.tsx`
  - `mobile-expo/src/native/utils/ReceiptFormatter.ts`
  - `mobile-expo/src/native/types.ts`
* **Current Flow**:
  - Checkout succeeds -> `checkoutSuccessInvoice` created -> User taps Print -> `printReceipt({ invoiceNumber, storeName })` passed without `items` -> Receipt prints 0 items.
* **Fix**:
  1. Map complete `checkoutSuccessInvoice` properties (`items`, `subtotal`, `gst`, `grandTotal`, `customerName`, `paymentMethod`, `cashierName`) into the `ReceiptPrintData` payload passed to `PrinterService.printReceipt`.
  2. Ensure `ReceiptFormatter.format58mmText` formats every item's name, quantity, unit price, and total line price.
* **Test**:
  - Checkout 2 x Product A + 1 x Product B -> Tap Print ESC/POS Receipt -> Verify receipt contains itemized rows for Product A and Product B.

---

## BUG 4: Android Print Chooser Dialog Opening Every Time

* **Reported Symptom**: Every time a bill is printed, Android prompts the user to select a printer/app through the system print chooser dialog.
* **Root Cause**:
  - Fallback printing pathways invoked standard system print intents (`Intent.createChooser` / `expo-print`), which launch the OS print dialog rather than sending direct thermal commands to a saved POS printer connection.
* **Files**:
  - `mobile-expo/src/native/services/PrinterService.ts`
  - `mobile-expo/src/screens/BillingScreen.tsx`
* **Current Flow**:
  - User taps Print -> System print intent invoked -> Android displays "Select Printer (Save as PDF)" chooser dialog every time.
* **Fix**:
  1. Maintain a persistent **Default Printer Profile** in SQLite (`printer_profiles`).
  2. Direct all checkout print requests to the default saved printer profile (Bluetooth SPP, USB Host, or Sunmi Built-in POS) without triggering OS print dialogs.
* **Test**:
  - Select default Bluetooth/Built-in POS printer -> Tap Print -> Prints directly to thermal printer with zero chooser dialogs.

---

## BUG 5: Printer Profile Management System

* **Reported Symptom**: Lack of a proper system for configuring custom thermal printers, setting a default printer, scanning Bluetooth/USB devices, and running test prints.
* **Root Cause**:
  - Printer configuration was hardcoded to a single global driver type without persistent multi-printer profile management in SQLite.
* **Files**:
  - `mobile-expo/src/database/schema.ts` (Add `printer_profiles` DDL)
  - `mobile-expo/src/database/repositories/printer.repository.ts` (New repository)
  - `mobile-expo/src/native/services/PrinterService.ts`
  - `mobile-expo/src/screens/SettingsScreen.tsx`
* **Fix**:
  1. Create `printer_profiles` table (`id`, `store_id`, `name`, `type`, `connection_type`, `address`, `paper_width`, `is_default`, `enabled`, `created_at`, `updated_at`).
  2. Build Printer Management UI in `SettingsScreen.tsx` (Add Printer, Select Connection Type: Bluetooth/USB/Built-in/System, Scan Devices, Set Default, Test Print).
  3. Default printer profile automatically receives all bill print commands without user intervention.
* **Test**:
  - Add Printer -> Set Default -> Run Test Print -> Restart App -> Verify default printer profile persists and prints cleanly.
