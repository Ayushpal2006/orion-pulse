# Native POS Hardware Integration Layer

This directory (`mobile/src/native/`) serves as the modular bridge and abstraction layer between React Native TypeScript and Android native hardware modules / vendor SDKs.

## Purpose
Apka Bill Mobile is an **Android-first POS system** engineered for high-performance in-store checkout and retail counter operations. In subsequent phases, this layer will directly communicate with Android platform APIs, JNI/NDK, and OEM SDKs.

---

## Roadmap & Planned Hardware Integrations

### 1. Thermal Printer Integration
- **Protocols Supported**: ESC/POS (standard receipt syntax), TSPL/CPCL (label printing).
- **Interfaces**:
  - **Bluetooth**: Classic Bluetooth (RFCOMM / SPP) & BLE thermal receipt printers.
  - **USB**: USB OTG / USB Host Mode with Android `UsbManager`.
  - **Network / LAN**: TCP socket printing (port 9100 / Raw JetDirect) for kitchen and counter printers.
  - **Built-in POS Printers**: Native SDK integrations for dedicated Android POS terminals (Sunmi V2/V2 Pro/T2, iMin, Pax, Posiflex).

### 2. Barcode & QR Scanner Integration
- **Hardware Laser Scanners**:
  - Broadcast Receiver listeners for integrated PDA/POS 1D/2D scanning engines (Honeywell, Zebra EMDK, Newland, Sunmi Scanner SDK).
  - USB HID / Bluetooth SPP barcode guns with rapid keystroke interception.
- **Camera Scanning**: High-framerate native camera scanner fallback for smartphones/tablets.

### 3. USB & Serial Connectivity
- Android USB Host APIs (`android.hardware.usb.*`) for cash drawer triggers, customer-facing displays (VFD/LCD pole displays), and electronic weighing scales.

### 4. Bluetooth Connection Manager
- Auto-discovery, paired device listing, bond state monitoring, and auto-reconnection loop for dropped Bluetooth printer connections.

### 5. Device-Specific POS SDKs
- Modular adapters allowing manufacturer SDKs to be plugged in without rewriting core checkout or billing logic.

---

## Phase 1 Status
- **Current State**: Abstraction interfaces and stub wrappers only.
- **Native Implementation**: Planned for future hardware phase.
