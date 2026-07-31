# APKA BILL V2: DETERMINISTIC CONFLICT RESOLUTION RULES

---

## 1. CONFLICT RESOLUTION MATRIX

| Scenario | Resolution Strategy | Action |
|---|---|---|
| **Duplicate Sale `offlineId`** | Client-side Idempotency | Return existing sale without re-deducting stock |
| **Product Price Updated Online** | Sale Time Lock | Sale honours price at time of offline checkout |
| **Product Deleted Online** | Virtual Fallback | Sale completes; item recorded with snapshot details |
| **Stock Discrepancy** | Negative Adjustment Entry | Inventory balance adjusted to reflect actual physical checkout |
| **Customer LTV Accrual** | Cumulative Summation | Wallet points & spent total added additively |
