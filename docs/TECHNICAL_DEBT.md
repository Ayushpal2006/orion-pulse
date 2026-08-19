# APKA BILL — TECHNICAL DEBT & CONTINUOUS IMPROVEMENT
**Document Version**: 1.0.0 (Architecture Roadmap)  
**Date**: 2026-08-19  

---

## 1. Tracked Technical Debt Items

| Debt ID | Subsystem | Description & Impact | Risk Level | Suggested Resolution | Priority |
|---|---|---|:---:|---|:---:|
| **DEBT-001** | **Camera Barcode Scan** | Uses default `expo-camera` modal overlay; could offer custom audio beep on successful scan | Low | Add lightweight sound playback feedback on barcode read | P3 |
| **DEBT-002** | **Receipt Image Logo** | Raster logo printing over Bluetooth ESC/POS requires monochrome bitmap encoding | Medium | Implement Floyd-Steinberg dithering for higher contrast logos | P2 |
| **DEBT-003** | **Multi-Store Mobile UI** | Single-store active context; store switching requires logout/login | Low | Add multi-store drawer switcher modal when multi-store customer tier launches | P2 |
| **DEBT-004** | **PDF Generation on Android** | Uses HTML print-to-file renderer via `expo-sharing` | Low | Cache generated PDF blobs in `expo-file-system` cache directory | P3 |
