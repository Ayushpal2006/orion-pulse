# APKA BILL — PRODUCTION REGRESSION CATALOG
**Document Version**: 1.0.0 (Quality Assurance & Regression Library)  
**Date**: 2026-08-19  

---

## 1. Regression Test Catalog

| Regression ID | Incident / Potential Defect | Root Cause | Automated Test / Guardrail | Release Fixed |
|---|---|---|---|:---:|
| **REG-001** | Thermal printer omitted purchased items & centered QR failed | Formatter assumed 3-column layout without 2-column small paper wrapping | `scratch/verify-thermal.mjs` | v1.0.1 |
| **REG-002** | Concurrent duplicate sync executions corrupting delta cursor | Lack of single-flight mutex lock on sync promise | `src/services/api/sync.service.ts` (`activeSyncPromise`) | v1.0.1 |
| **REG-003** | Retry printing creating duplicate sales in database | Tightly coupling printer driver call inside POS checkout transaction | Decoupled `SalesService.processCheckout` & `PrinterService` | v1.0.1 |
| **REG-004** | Cross-store tenant data leakage during store switching | Queries missing strict compound `store_id` filter | Multi-store scoped repositories (`ProductRepository`, `SaleRepository`) | v1.0.1 |
| **REG-005** | Double-tap checkout submitting duplicate invoices | Missing unique idempotency key on checkout requests | `clientMutationId` & `X-Offline-Id` header handling | v1.0.1 |
| **REG-006** | Incompatible OTA JS bundle breaking native printer SDK | Lack of runtime version locking on OTA updates | `"runtimeVersion": { "policy": "appVersion" }` | v1.0.1 |
| **REG-007** | Inadvertent localhost/staging URL bundled in release | Developer environment variables leaking into build | `scripts/validate-release.mjs` preflight validation | v1.0.1 |
