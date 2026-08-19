# APKA BILL — P7-D UPDATE & OTA REGRESSION TEST REPORT
**Document Version**: 1.0.0 (Production Verification P7-D)  
**Date**: 2026-08-19  

---

## 1. Update Test Matrix

| Test Case | Expected Behavior | Actual Behavior | Result |
|---|---|---|:---:|
| **1. JS-Only OTA Update** | Updates UI elements without native binary reinstallation | OTA bundle applies cleanly | **PASS** |
| **2. OTA Startup Verification** | App boots without crashing on update load | Clean startup into Dashboard | **PASS** |
| **3. OTA Instant Rollback** | Rolling back EAS Update channel reverts immediately | Reverts to prior JS state | **PASS** |
| **4. Native APK Update Over Existing** | Installs new APK over previous build without data loss | Database and session preserved | **PASS** |
| **5. SQLite Forward Migration** | Existing tables upgraded cleanly via sequential migrations | 100% data intact across tables | **PASS** |
| **6. Outbox Queue Preservation** | Pending mutations survive app upgrade | Outbox records survive & sync | **PASS** |
| **7. Native Printer SDK Update** | New native build loads AutoReplyPrint driver correctly | Bluetooth & USB printers work | **PASS** |
| **8. Offline Sale Before Update** | Offline sale committed to SQLite survives app upgrade | Survives upgrade & syncs | **PASS** |
| **9. Pending Sync Before Update** | Unsynced transactions upload cleanly after app update | Single-flight sync commits all | **PASS** |
| **10. Backend Additive Compatibility**| Backend accepts both legacy and new client payloads | Zero contract breakages | **PASS** |
| **11. Version Tracking in Monitoring**| Diagnostics record appVersion & runtimeVersion | Correctly tags all error logs | **PASS** |
| **12. POS Active Cart Protection** | Background update does not interrupt active cart/checkout | Cashier workflow uninterrupted | **PASS** |
| **13. Failed Update Download Recovery**| Network drop during update leaves working app functional | Fallbacks to existing bundle | **PASS** |
| **14. Preflight Release Automation** | `scripts/validate-release.mjs` validates release safety | 100% checks passed | **PASS** |
