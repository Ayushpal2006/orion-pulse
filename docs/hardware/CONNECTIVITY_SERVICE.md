# APKA BILL V2: CONNECTIVITY MONITORING & DIAGNOSTICS SERVICE

---

## 1. INDEPENDENT HEALTH CHECKS

The `ConnectivityService` operates independently from standard browser network triggers to monitor:
- Internet Access (`navigator.onLine`)
- Backend Endpoint Health (`GET /health`)
- Database Readiness
- Pending Sync Queue Count (`getPendingSalesCountOffline()`)
- Printer & Scanner Hardware Connections

---

## 2. REAL-TIME DIAGNOSTICS DASHBOARD

Status Badges:
- 🟢 **Internet Connected**
- 🟢 **Backend Healthy**
- 🟢 **Local Database Ready**
- 🟡 **Pending Sync (Count)**
- 🟢 **Printer Connected**
- 🟢 **Organization & Store Loaded**
