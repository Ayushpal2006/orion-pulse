# APKA BILL — P7-D PRODUCTION UPDATE STRATEGY REPORT
**Document Version**: 1.0.0 (Release Framework)  
**Date**: 2026-08-19  

---

## 1. Expo & EAS Configuration
* **App Name**: Apka Bill POS
* **Package**: `com.apkabill.mobile`
* **Version**: `1.0.1` (versionCode: `2`)
* **Runtime Version**: `{ "policy": "appVersion" }`
* **EAS Update Channels**: `production`, `preview`, `development`
* **Backend Endpoint**: `https://apka-bill.onrender.com`

---

## 2. Release Management Framework

### 2.1 OTA vs. Native Binary Matrix

| Change Type | Release Category | Delivery Mechanism | `versionCode` Bump? |
|---|:---:|:---:|:---:|
| **UI Fixes, Typography, Copy** | Category A | EAS Update (`production`) | No |
| **POS Cart Calculations / Validation** | Category A | EAS Update (`production`) | No |
| **New Native Printer SDK / Drivers** | Category B | EAS Build (`preview`/`production`) | Yes |
| **Android Permissions (Bluetooth/Camera)**| Category B | EAS Build (`preview`/`production`) | Yes |
| **SQLite Schema Migrations** | Category C | EAS Build (`preview`/`production`) | Yes |
| **Backend API Additions** | Category D | Render Deployment | No |

---

## 3. Rollback & Fail-Safe Protocols
1. **OTA Rollback**: Re-publish previous known-good JS update to the `production` EAS Update channel.
2. **Crash Interception**: `ErrorBoundary` provides an interactive recovery screen if a faulty render occurs.
3. **Database Guardrails**: SQLite database files are never reset, dropped, or wiped during application upgrades.
