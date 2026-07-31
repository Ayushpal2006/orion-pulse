# APKA BILL V2: HARDWARE ABSTRACTION LAYER (HAL) ARCHITECTURE

---

## 1. MISSION & DECISION MATRIX

The Billing Engine & Checkout Flow in Apka Bill V2 are **SACRED**. No hardware implementation or vendor SDK directly modifies checkout calculation, inventory state, or UI rendering. All hardware interactions pass strictly through the Hardware Abstraction Layer (HAL).

```
                            [Billing Engine]
                                   │
                                   ▼
                       [Hardware Service Facade]
                                   │
                 ┌─────────────────┼─────────────────┐
                 ▼                 ▼                 ▼
          [Printer HAL]      [Scanner HAL]    [Cash Drawer HAL]
                 │                 │                 │
                 ▼                 ▼                 ▼
          [SDK Adapters]     [HID Handlers]    [Pulse Command]
```

---

## 2. SUPPORTED DEVICE TYPES

- **Thermal Printers**: ESC/POS, Sunmi, iMin, Telpo, PAX, Wiseasy, Urovo, Newland, XPrinter, Rongta
- **Barcode Scanners**: USB HID Keyboard Scanner, Bluetooth SPP, Camera Barcode Scanner
- **Cash Drawers**: ESC/POS RJ11 Pulse (`pin2` / `pin5`), SDK Native Drawer Command
- **Customer Display Units**: VFD Pole Display, Secondary Screen WebBridge
- **Weighing Scales**: RS232 Serial / USB Weighing Scale Abstraction
