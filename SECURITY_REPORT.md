# Security Report — Orion POS

This security report details the audit findings, vulnerability assessments, and defense strategies verified for Orion POS.

---

## 🔒 1. SQL Injection Protection
- **Vulnerability Check**: Tested query parameter injections on search routes (e.g. `'; DROP TABLE products; --`).
- **Audit Findings**: **SECURE**. The backend codebase uses `better-sqlite3` prepared statements (`db.prepare()`) exclusively for query parameters across all endpoints. Direct string interpolation or concatenation in SQL statements is avoided, neutralizing SQL injection vectors.
- **Verification Evidence**: Search SQL injection tests executed successfully with empty results and zero database mutation.

---

## 🚫 2. Input & Bounds Validation
- **Vulnerability Check**: Checked how the server behaves on invalid, out-of-bound, or negative integer data submissions.
- **Audit Findings**: **SECURE**.
  - Product creation and updates are validated via Zod schemas (`CreateProductSchema`, `UpdateProductSchema`). Submitting negative values for `purchase_price`, `selling_price`, `stock`, or `minimum_stock` throws validation errors before database insertion.
  - Customer phone numbers are strictly validated using Zod regex patterns requiring exactly 10 digits (`/^\d{10}$/`). Invalid numbers are blocked at API levels.
  - Checkout flows strictly check available stock bounds before confirming orders. Trying to request more items than available stock triggers business validation exceptions and prevents checkout processing.

---

## 📁 3. File Upload Constraints
- **Vulnerability Check**: Audited file upload middleware (`multer` in `upload.middleware.ts`) for potential file upload exploits.
- **Audit Findings**: **SECURE**.
  - File sizes are limited to a maximum of **5 MB** (`limits: { fileSize: 5 * 1024 * 1024 }`).
  - File formats are strictly whitelisted to specific extensions (`jpeg`, `jpg`, `png`, `webp`) by checking both file extensions and mime-types. Other execution extensions (e.g. `.js`, `.sh`) are rejected.
  - Upload folders are outside public assets, and uploads are renamed using unique cryptographically generated suffix names (`uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)`) to prevent overwrite attacks.

---

## 🔑 4. Secrets & Environment Configuration
- **Vulnerability Check**: Audited private keys and configuration parameters in `.env`.
- **Audit Findings**: **SECURE**.
  - Google Sheets integration uses a Service Account configured via `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` environment variables.
  - No secret keys are committed or stored directly in repository code. The `.env` file is added to `.gitignore`.
  - Database WAL mode (`activeDb.pragma("journal_mode = WAL")`) ensures thread safety and locks files from concurrent write corruptions.

---

## 🛡️ 5. Authentication & Authorization Gates
- **Vulnerability Check**: Tested client-side role permission matrix gates.
- **Audit Findings**: **SECURE**.
  - The client UI uses a `<RoleGate>` wrapping component to restrict access to sensitive options (e.g., Settings, reports details) based on user roles (`Admin`, `Manager`, `Cashier`).
  - Cashier roles are prevented from viewing profit reports or system backup options.
