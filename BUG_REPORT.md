# Bug Report — Orion POS

This bug report logs all functional anomalies, edge-case failures, or configuration bugs discovered during the Production Readiness Audit of the Orion POS codebase.

---

## 🛑 Critical / High Severity

### 1. Custom Date Range Report Filter Query Crash
- **Title**: Custom Date Filter SQLite Named Parameter Reference Error
- **Description**: Accessing reports or exporting Excel spreadsheets using the `custom` date filter crashed the Express server with an internal 500 status: `Missing named parameter "startDate"`.
- **How to Reproduce**:
  1. Trigger custom date fetch: `GET /reports?filter=custom&startDate=2026-07-01&endDate=2026-07-10`
  2. The server responds with `500 Internal Server Error` instead of compiling the sales metrics.
- **Expected Result**: SQLite compiles sales within the custom range and returns JSON metrics correctly.
- **Actual Result**: `better-sqlite3` threw an error because parameter names specified in the SQL query as `$startDate` and `$endDate` were mapped in the params object as `$startDate` and `$endDate`. In better-sqlite3, parameter prefixes (`$`, `@`, `:`) are stripped from object key mappings, resulting in lookups failing for the bare parameter keys (`startDate`, `endDate`).
- **Severity**: Critical (Blocks reports querying and excel exports)
- **Status**: **FIXED** (Updated `backend/src/repositories/reports.repository.ts` to map parameters as bare keys (`startDate`, `endDate`) inside the params object).
- **Verification**: Verified using a curl request `GET /reports?filter=custom...` which now successfully yields sales and revenue values.

---

## ⚠️ Medium Severity

*(No medium-severity issues were found. Core checkout transactions, stock adjustments, and soft-delete/restoration workflows are fully validated.)*

---

## ℹ️ Low Severity / Harmful Warnings

### 2. Frontend Root Hydration Mismatch Warning
- **Title**: React SSR Hydration Mismatch on Root Route
- **Description**: On initial page load, the browser console issues a warning: `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.`
- **How to Reproduce**:
  1. Open http://localhost:8081 in browser.
  2. Inspect the developer console.
- **Expected Result**: Zero console warnings.
- **Actual Result**: A react-hydration-warning occurs when client-side extensions or styling classes alter DOM attributes before hydration processes complete.
- **Severity**: Low
- **Status**: **RESOLVED/DOCUMENTED** (Harmless. Verified it does not affect page loads, states, or checkout flows).
