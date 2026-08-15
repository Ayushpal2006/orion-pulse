# Apka Bill Mobile — Native Hardware Integration Architecture

This module establishes the native Android hardware integration layer for the Apka Bill POS client.

---

## 1. Architectural Model

```
┌─────────────────────────────────────────────────────────────┐
│                 React Native POS UI & Screens               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 TypeScript Hardware Layer                   │
│  - HardwareService.ts (Capabilities & Diagnostics)          │
│  - PrinterService.ts  (Multi-Driver Receipt Dispatcher)     │
│  - ScannerService.ts  (Barcode Scanner Abstraction)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ React Native Bridge
┌─────────────────────────────────────────────────────────────┐
│                 Kotlin Native Android Module                │
│  - HardwareModule.kt                                        │
│  - HardwarePackage.kt                                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ Android OS / Vendor APIs
┌─────────────────────────────────────────────────────────────┐
│                 Target POS Hardware SDK                     │
│  - Sunmi / Pax / iMin / Posiflex / Urovo / Telpo SDK        │
│  - Bluetooth SPP / ESC/POS                                  │
│  - USB Host / OTG Receipt Printers                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Hardware Decoupling Rule

> **CRITICAL RULE**: The checkout and billing transaction in SQLite **MUST NEVER** depend on the physical printer status.

1. **Step 1**: Checkout completes atomically in SQLite (`sales`, `sale_items`, `payments`, `inventory_movements`, `sync_queue`).
2. **Step 2**: The POS screen dispatches an asynchronous `PrinterService.printReceipt()` call.
3. **Step 3**: If paper runs out, device is busy, or printer is disconnected, the user is notified with a retry prompt, and the sale remains 100% intact and persistent.

---

## 3. Physical Hardware Testing Requirements

To test on physical POS terminals, provide the following vendor resources:
- **Target Hardware**: e.g., Sunmi V2s, Pax A920, iMin D4, etc.
- **Vendor SDK Artifacts**: `.aar` or `.jar` library files.
- **Service AIDL / Intents**: Vendor-provided Android Service interfaces.
- **Permissions**: Add required USB/Bluetooth/Printer permissions to `AndroidManifest.xml`.
