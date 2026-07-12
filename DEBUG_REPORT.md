# Debug Diagnostics Log — Startup & Loading Issues

This report details the diagnostics and resolutions implemented for the Orion POS startup and infinite loading screen issue.

---

## 1. Root Cause Analysis

### A. Port Collision (Primary Blocker)
- **Problem**: Both the frontend Vite development server (using `@lovable.dev/vite-tanstack-config`) and the Express backend server (configured in `.env` and `server.ts`) defaulted to port `8080` when booting locally.
- **Consequence**: 
  - If the frontend booted first, it bound port `8080`. The backend then failed to start due to `EADDRINUSE`.
  - In this state, the frontend's API calls to `http://localhost:8080` were captured by Vite's dev server itself. Because of SPA routing fallback, Vite returned `index.html` (status `200`) instead of API JSON data.
  - The frontend parsed the HTML as JSON, resulting in a parsing `SyntaxError` (`Unexpected token <`). This threw errors inside React Query and custom loaders.

### B. Blocking Backend Initializations
- **Problem**: Long-running or heavy background initialization routines (Outfit Font downloads, background Google Sheets queue manager boot, PDF cleanups) were triggered synchronously or asynchronously *before* the server began listening.
- **Consequence**: If any setup task stalled (e.g., due to file system locks or network timeouts on Node.js v25), it delayed or completely blocked the execution of `app.listen()`, preventing the API from starting.

### C. Missing Client Timeout & Error States
- **Problem**: Frontend network calls made via browser `fetch` did not enforce any timeout limits.
- **Consequence**: If the backend hung or was locked, the network request stayed pending indefinitely, keeping the React Query queries in an eternal loading state and leaving the user stuck on the spinner screen.
- **Problem**: Key pages (Dashboard and Customers list) did not have `isError` query states. When requests failed, they stayed on a blank screen or spinner indefinitely.

---

## 2. Files Responsible & Modified

1. **[vite.config.ts](file:///Users/ayush/Documents/Code/orion-pulse-main/vite.config.ts)**: Configured Vite server to bind to port `8081` with `strictPort: true`.
2. **[router.tsx](file:///Users/ayush/Documents/Code/orion-pulse-main/src/router.tsx)**: 
   - Injected a global `window.fetch` interceptor to enforce a strict `10-second` timeout limit.
   - Configured `QueryClient` defaults with `retry: 1` to fail fast during backend outages.
3. **[api.ts](file:///Users/ayush/Documents/Code/orion-pulse-main/src/lib/api.ts)**: Exported `API_BASE_URL` with support for dynamic environment variable (`import.meta.env.VITE_API_URL`) fallbacks.
4. **[server.ts](file:///Users/ayush/Documents/Code/orion-pulse-main/backend/src/server.ts)**: Reordered background boot services to execute safely within the `app.listen()` callback block.
5. **[index.tsx](file:///Users/ayush/Documents/Code/orion-pulse-main/src/routes/index.tsx)** (Dashboard): Implemented `isErrorDashboard` checking and a user-facing retry panel.
6. **[customers.tsx](file:///Users/ayush/Documents/Code/orion-pulse-main/src/routes/customers.tsx)** (Customers): Implemented `isError` check on listing query and added retry options.
7. **[settings.tsx](file:///Users/ayush/Documents/Code/orion-pulse-main/src/routes/settings.tsx)**, **[reports.tsx](file:///Users/ayush/Documents/Code/orion-pulse-main/src/routes/reports.tsx)**, **[billing.tsx](file:///Users/ayush/Documents/Code/orion-pulse-main/src/routes/billing.tsx)**, **[command-palette.tsx](file:///Users/ayush/Documents/Code/orion-pulse-main/src/components/command-palette.tsx)**: Replaced hardcoded `http://localhost:8080` URLs with imported `API_BASE_URL`.

---

## 3. Changes Made & Resolutions

### Port Separation & Environment Consistency
- Locked frontend development port to `8081` and Express backend API to `8080`.
- Ensured dynamic config fallback: if `VITE_API_URL` is defined, the client respects it; otherwise, it defaults to the Express port `8080`.

### Client Hardening (Global Fetch Timeout Interceptor)
- Applied a non-invasive global interceptor:
  ```typescript
  if (typeof window !== "undefined" && !(window as any).__fetchPatched__) {
    (window as any).__fetchPatched__ = true;
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        return await originalFetch(input, { ...init, signal: init?.signal || controller.signal });
      } catch (error: any) {
        if (error.name === "AbortError") throw new Error("Request timed out. The server did not respond.");
        throw error;
      }
    };
  }
  ```

### Non-blocking Backend Startup
- Refactored `server.ts` to defer non-critical services (font downloads, queue checks, and storage cleanups) until *after* the port listener starts successfully:
  ```typescript
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    downloadFonts().catch(...);
    SyncQueueManager.getInstance();
    schedulePdfCleanup();
  });
  ```

### Error State Handlers
- Created visual fallback error states on key landing views with a `<Button onClick={() => refetch()}>` trigger.

---

## 4. Verification & Testing

### Test A: Backend Running, Frontend Running
- **Result**: The dashboard successfully starts up on `http://localhost:8081`, queries `http://localhost:8080`, and renders stats immediately without delay.

### Test B: Backend Offline, Frontend Running
- **Result**: Rather than hanging on a spinner, the Dashboard displays an offline panel ("Dashboard metrics could not be loaded") in 10 seconds. Clicking "Retry" triggers a fresh query.

---

## 5. Status Summary

| Issue | Status | Details |
| --- | --- | --- |
| **Vite Dev Server Port Collision** | ✅ Fixed | Port locked to `8081`. |
| **Backend EADDRINUSE exit** | ✅ Fixed | Express binds to `8080` without competition. |
| **Infinite pending fetch requests** | ✅ Fixed | Aborted automatically after 10s. |
| **Unresolved loaders/spinners** | ✅ Fixed | Fail-fast query retries and visual retry displays added. |
| **Delayed backend starts** | ✅ Fixed | Deferment of background processes. |
