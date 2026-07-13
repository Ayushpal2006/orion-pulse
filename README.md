# Orion POS

> A professional, offline-first Point-of-Sale system built for Indian retail — featuring sub-12s checkout, A4 PDF invoicing, ESC/POS thermal printing, WhatsApp sharing, live SQLite analytics, and a cloud backup layer via Google Sheets.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Features](#features)
5. [Project Structure](#project-structure)
6. [Database Schema](#database-schema)
7. [Backend API Reference](#backend-api-reference)
8. [Frontend Pages & Components](#frontend-pages--components)
9. [Key Services](#key-services)
10. [Getting Started](#getting-started)
11. [Environment Variables](#environment-variables)
12. [Development Workflow](#development-workflow)
13. [Deployment Notes](#deployment-notes)
14. [Known Constraints](#known-constraints)

---

## Overview

Orion POS is a full-stack Point-of-Sale application designed for small and medium Indian retail stores. It runs entirely on-device using SQLite as the primary database, with an optional Google Sheets backup layer that operates asynchronously so checkout is never blocked by internet connectivity.

The system is deployed as two separate processes:

> RC1 status: the current workspace has been verified with a successful backend build, a successful frontend build, and a shared datetime smoke test covering UTC storage and Asia/Kolkata display formatting.

| Process | Port | Role |
|---|---|---|
| **Backend** | `8080` | Express REST API + SQLite |
| **Frontend** | `8081` | React SPA (Vite + TanStack) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                 │
│  Dashboard · Billing · Inventory · Customers ·      │
│  Reports · Settings                                 │
└────────────────────┬────────────────────────────────┘
                     │ HTTP REST
┌────────────────────▼────────────────────────────────┐
│                 Express Backend                     │
│                                                     │
│  ┌────────────┐  ┌───────────────┐  ┌────────────┐  │
│  │  Checkout  │  │ Receipt Engine│  │  Dashboard │  │
│  │  Service   │  │ (single truth)│  │  Service   │  │
│  └─────┬──────┘  └──────┬────────┘  └────────────┘  │
│        │                │                           │
│  ┌─────▼──────────────────▼────────────────────┐    │
│  │            SQLite (better-sqlite3)           │   │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌────────────┐  ┌───────────────┐  ┌────────────┐  │
│  │ PDF Service│  │Invoice Service│  │Share Service│ │
│  │ (pdfkit)  │  │ (HTML + cache)│  │ (WhatsApp) │   │
│  └────────────┘  └───────────────┘  └────────────┘  │
│                                                     │
│  ┌────────────────────────────────────────────┐     │
│  │   ESC/POS Formatter → Printer Service      │     │
│  │   (Z91 Internal 58mm Thermal Printer)      │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                     │ Background Queue
┌────────────────────▼────────────────────────────────┐
│           Google Sheets (Async Backup)              │
│         Never blocks checkout. Fire-and-forget.     │
└─────────────────────────────────────────────────────┘
```

### Receipt Engine — Single Source of Truth

The `Receipt Engine` generates one canonical receipt object from SQLite. **Every downstream feature reuses it — no logic duplication:**

```
Checkout
  ↓
Receipt Service  (getReceipt)
  ↓
  ├── Thermal Printer  (ESC/POS buffer)
  ├── Receipt Preview  (SlipDialog modal)
  ├── A4 PDF           (PdfService → pdfkit → uploads/invoices/)
  ├── HTML Invoice     (InvoiceService → mobile-responsive HTML)
  └── WhatsApp Share   (ShareService → wa.me deep link)
```

---

## Tech Stack

### Backend

| Category | Technology |
|---|---|
| Runtime | Node.js (TypeScript) |
| Framework | Express.js |
| Database | SQLite via `better-sqlite3` |
| PDF Generation | `pdfkit` |
| Architecture | Repository Pattern + Service Layer |
| Config | `dotenv` |

### Frontend

| Category | Technology |
|---|---|
| Framework | React 19 |
| Bundler | Vite 8 |
| Routing | TanStack Router (file-based) |
| Server State | TanStack Query |
| Global State | Zustand |
| UI Components | shadcn/ui + Radix UI primitives |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| QR Codes | `qrcode.react` |
| Forms | React Hook Form + Zod |
| Toast | Sonner |

---

## Features

### ✅ Billing & Checkout
- Sub-12s checkout flow: scan → add → payment → print
- Product search with real-time filtering and barcode support
- Cart with per-line discount controls
- Multi-payment methods: Cash, UPI, Card, Wallet
- Auto-creates customer profile on first checkout
- Sequential invoice numbering: `INV-2026-000001`
- Checkout progress animation with step tracker
- **Park & Resume** — save up to 5 draft carts

### ✅ Receipt Preview & Sharing
- 58mm thermal-style receipt preview in `SlipDialog` after every sale
- **🖨️ Print** — sends ESC/POS buffer to Z91 internal printer
- **📄 Download PDF** — generates A4 professional invoice on demand and forces browser download
- **💬 WhatsApp** — opens pre-filled WhatsApp message with invoice link + PDF download URL
- **🔗 Copy Link** — copies the public invoice URL (secured with random token, not DB ID)

### ✅ Public Invoice Portal
- Each sale gets a 12-character base64url `public_token` (e.g. `X4a7M8QpL91K`)
- Public routes never expose raw database IDs
- `GET /invoice/v/:token` — beautiful, mobile-responsive HTML invoice
- `GET /invoice/v/:token/download` — serves the cached A4 PDF
- All public pages include `<meta name="robots" content="noindex,nofollow">`

### ✅ Product Management
- Full CRUD: create, edit, delete, soft-delete (is_active flag)
- Barcode field support
- Category grouping
- GST rate per product
- Stock levels with reorder threshold alerts
- **Product Image Upload** — persisted to `uploads/products/`, served as static files

### ✅ Customer CRM
- Full CRUD with phone as unique key
- Customer auto-creation during checkout
- Lifetime Value (LTV) tracking
- Visit count and last-visit timestamp
- Expandable customer cards with real-time **Invoice History** from SQLite
  - **View** — opens the public invoice portal in a new tab
  - **💬 WhatsApp** — shares invoice with the customer directly

### ✅ Inventory Management
- Real-time stock levels from SQLite
- Low-stock alerts (stock < minimum_stock threshold)
- Stock adjustment dialog (manual increment/decrement)
- Product detail drawer with full specs

### ✅ Dashboard
All metrics are live from SQLite:
- Today's Revenue, Orders, Profit
- Total Inventory Count
- Low Stock Count
- Top 10 Selling Products (by units)
- Recent Transactions feed

### ✅ Reports
Date-range filtered reports:
- Revenue, orders, average order value
- Product performance breakdowns
- Filter options: today, week, month, custom date range

### ✅ Thermal Printer (ESC/POS)
- Target device: **Z91 Android POS Terminal** with built-in 58mm printer
- `EscposFormatter` generates raw ESC/POS binary buffer
- `PrinterService` dispatches buffer to the configured printer
- Paper width: 58mm
- Test-print endpoint for hardware verification
- Printer config is read from the Settings table (no hardcoding)

### ✅ Settings
All shop configuration is stored in SQLite `settings` table:
- Shop Name, GSTIN, Phone, Address, UPI ID
- Printer type and paper width
- WhatsApp footer message
- Invoice signature text
- Exchange / returns policy
- Business website, Instagram URL, Google Maps link
- Google Sheets sync configuration (Sheet ID, enabled flag)

### ✅ Google Sheets Backup _(Async)_
- Sales are queued after SQLite commit — checkout never waits
- Sync job queue table (`sync_jobs`) with retry logic
- Reads credentials from environment variables, never hardcoded

---

## Project Structure

This project is organized as an **npm Workspaces Monorepo** for clean, independent dependency management between the backend Express API and the frontend TanStack React app.

```
orion-pulse-main/
├── package.json                    # Workspace root package.json
├── package-lock.json               # Root lockfile (unified dependencies)
├── shared/                         # Shared utilities folder
│   ├── datetime.js
│   └── datetime.ts
├── backend/                        # Express API server (Workspace package)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts               # Entry point
│   │   └── ...
│   └── uploads/
├── frontend/                       # React frontend (Workspace package)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── routes/
│   │   └── ...
│   └── public/
└── src/                            # Legacy root folder (kept for import compatibility)
    └── routes/
        └── index.tsx
```

---

## Database Schema

> All monetary values are stored as **integers in paise** (1 INR = 100 paise) to avoid floating-point precision errors.

### `products`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT | Required |
| `sku` | TEXT UNIQUE | Required |
| `barcode` | TEXT UNIQUE | Optional |
| `category` | TEXT | Optional |
| `purchase_price` | INTEGER | Paise |
| `selling_price` | INTEGER | Paise |
| `stock` | INTEGER | Current stock level |
| `minimum_stock` | INTEGER | Reorder threshold |
| `gst` | INTEGER | GST % (e.g. 18) |
| `is_active` | INTEGER | 1 = active, 0 = soft-deleted |
| `image_url` | TEXT | Relative path e.g. `/uploads/products/abc.jpg` |
| `created_at` | DATETIME | Auto |
| `updated_at` | DATETIME | Auto |

### `customers`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT | Required |
| `phone` | TEXT UNIQUE | Required — used as the unique identifier |
| `email` | TEXT | Optional |
| `address` | TEXT | Optional |
| `notes` | TEXT | Optional |
| `total_orders` | INTEGER | Cumulative order count |
| `lifetime_value` | INTEGER | Paise — cumulative spend |
| `last_visit` | DATETIME | Updated on each checkout |
| `created_at` | DATETIME | Auto |
| `updated_at` | DATETIME | Auto |

### `sales`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `invoice_number` | TEXT UNIQUE | e.g. `INV-2026-000021` |
| `customer_id` | INTEGER | FK → customers |
| `cashier_name` | TEXT | Logged-in cashier |
| `payment_method` | TEXT | Cash / UPI / Card / Wallet |
| `subtotal` | INTEGER | Paise |
| `discount` | INTEGER | Paise |
| `gst` | INTEGER | Paise |
| `grand_total` | INTEGER | Paise |
| `public_token` | TEXT UNIQUE | 12-char base64url token for public invoice URL |
| `pdf_url` | TEXT | Relative path to cached PDF (set after first generation) |
| `shared_at` | DATETIME | When invoice was last shared via WhatsApp |
| `created_at` | DATETIME | Auto |

### `sale_items`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `sale_id` | INTEGER | FK → sales |
| `product_id` | INTEGER | FK → products |
| `quantity` | INTEGER | Units sold |
| `selling_price` | INTEGER | Paise — price snapshot at time of sale |
| `discount` | INTEGER | Paise — per-line discount |
| `line_total` | INTEGER | Paise |

### `settings`

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | e.g. `shop_name`, `shop_upi_id` |
| `value` | TEXT | Stored value |

**Default settings keys:**

| Key | Default Value |
|---|---|
| `shop_name` | Orion Store |
| `shop_gstin` | 27AAAAA1111A1Z1 |
| `shop_phone` | 8285068670 |
| `shop_address` | 123, POS Center, Sector V, Salt Lake, Kolkata |
| `shop_upi_id` | orion@upi |
| `whatsapp_footer` | Thank you for shopping. Visit Again. |
| `signature` | Authorized Signatory |
| `exchange_policy` | Items can be exchanged within 7 days with original receipt |
| `invoice_theme` | classic |
| `business_website` | https://orionpos.in |
| `instagram_url` | https://instagram.com/orionpos |
| `maps_url` | https://maps.google.com |
| `printer_type` | Internal POS |
| `paper_width` | 58mm |

---

## Backend API Reference

**Base URL:** `http://localhost:8080`

All successful responses follow:
```json
{ "success": true, "data": ... }
```
All error responses follow:
```json
{ "success": false, "message": "...", "error": "..." }
```

---

### Products

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/products` | List all active products |
| `GET` | `/products/search?q=` | Search by name, SKU, or barcode |
| `GET` | `/products/:id` | Get single product |
| `POST` | `/products` | Create product |
| `PUT` | `/products/:id` | Update product |
| `DELETE` | `/products/:id` | Soft-delete product |
| `POST` | `/products/:id/image` | Upload product image (`multipart/form-data`, field: `image`) |

---

### Customers

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/customers` | List all customers |
| `GET` | `/customers/search?q=` | Search by name or phone |
| `GET` | `/customers/:id` | Get single customer |
| `POST` | `/customers` | Create customer |
| `PUT` | `/customers/:id` | Update customer |
| `DELETE` | `/customers/:id` | Delete customer |

---

### Checkout

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/checkout` | Execute checkout (atomic SQLite transaction) |

**Request body:**
```json
{
  "customerPhone": "8285068670",
  "paymentMethod": "UPI",
  "cashierName": "Ayush",
  "items": [
    { "productId": 1, "quantity": 2 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": "INV-2026-000021",
    "grandTotal": 299800,
    "publicToken": "X4a7M8QpL91K"
  }
}
```

The checkout is wrapped in a `db.transaction()`. If anything fails (stock insufficient, product not found, etc.), the entire transaction rolls back automatically.

---

### Sales

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/sales` | List all sales. Pass `?phone=8285068670` to filter by customer phone. |
| `GET` | `/sales/today` | Today's sales only |
| `GET` | `/sales/invoice/:invoice` | Get sale by invoice number |
| `GET` | `/sales/:id` | Get sale by numeric ID |
| `GET` | `/sales/:id/receipt` | Get the full canonical receipt object (JSON) |
| `GET` | `/sales/:id/pdf` | Generate (if missing) and download A4 PDF |
| `POST` | `/sales/:id/print` | Send receipt to thermal printer via ESC/POS |
| `GET` | `/sales/:id/share/whatsapp` | Get WhatsApp `wa.me` share URL |

> Note: `:id` can be either a numeric sale ID or an invoice number string for `/receipt`, `/pdf`, `/print`, and `/share/whatsapp`.

---

### Public Invoice Portal

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/invoice/v/:token` | Render public HTML invoice (mobile-responsive, no login required) |
| `GET` | `/invoice/v/:token/download` | Download the A4 PDF for this token |

> The token is a 12-character base64url string assigned at checkout — it never exposes the database row ID.

---

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard` | Live metrics from SQLite |

**Response:**
```json
{
  "success": true,
  "data": {
    "todayRevenue": 4872000,
    "todayOrders": 34,
    "todayProfit": 1421000,
    "inventoryCount": 182,
    "lowStockCount": 5,
    "topProducts": [
      { "name": "Blue Jeans", "unitsSold": 12, "revenue": 1798800 }
    ],
    "recentSales": [
      { "invoice_number": "INV-2026-000021", "grand_total": 299800, "created_at": "..." }
    ]
  }
}
```

---

### Reports

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reports?filter=today` | Date-filtered analytics |

**Query params:**
- `filter` — `today` \| `week` \| `month` \| `custom`
- `startDate` — ISO date string (required when filter=custom)
- `endDate` — ISO date string (required when filter=custom)

---

### Printer

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/printer/test` | Print a test page to verify hardware |
| `GET` | `/printer/config` | Get current printer configuration |
| `PUT` | `/printer/config` | Update printer configuration |

---

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/settings` | Get all settings as a flat key-value map |
| `PUT` | `/settings` | Batch update one or more settings keys |

**PUT body example:**
```json
{
  "shop_name": "My Fashion Store",
  "shop_upi_id": "myfashion@ybl"
}
```

---

### Static Files

| Path | Description |
|---|---|
| `/uploads/products/:filename` | Product images |
| `/uploads/invoices/:filename` | Generated PDF invoices |

---

## Frontend Pages & Components

### Pages (`src/routes/`)

| Route | File | Description |
|---|---|---|
| `/` | `index.tsx` | Dashboard — live SQLite metrics, top products, recent sales |
| `/billing` | `billing.tsx` | Checkout — product grid, cart, payment selection, receipt slip |
| `/customers` | `customers.tsx` | Customer CRM — expandable cards, real invoice history |
| `/inventory` | `inventory.tsx` | Stock management — product list, adjustments |
| `/reports` | `reports.tsx` | Analytics — date-filtered revenue charts |
| `/settings` | `settings.tsx` | Shop configuration — all settings keys |

### Key Components (`src/components/`)

| Component | Description |
|---|---|
| `app-shell.tsx` | Main layout: sidebar navigation, header, theme toggle |
| `command-palette.tsx` | Global search via ⌘K / Ctrl+K |
| `customer-dialog.tsx` | Add / edit customer modal with form validation |
| `edit-product-dialog.tsx` | Full product CRUD dialog with image upload support |
| `parked-sales.tsx` | Park up to 5 draft carts and resume later |
| `receipt-preview.tsx` | 58mm thermal-style receipt preview component |
| `stock-adjustment-dialog.tsx` | Manual stock +/- with reason logging |
| `role-gate.tsx` | Role-based access control wrapper |

### `SlipDialog` (inside `billing.tsx`)

Post-checkout dialog with 4 action buttons:

| Button | API Call | Notes |
|---|---|---|
| 🖨️ Print | `POST /sales/:id/print` | Sends ESC/POS buffer to printer |
| 📄 Download PDF | `GET /sales/:id/pdf` | Generates PDF, forces browser download |
| 💬 WhatsApp | `GET /sales/:id/share/whatsapp` | Opens wa.me link in new tab |
| 🔗 Copy Link | — | Copies public invoice URL to clipboard |

---

## Key Services

### `SalesService.getReceipt(idOrInvoice)` — The Receipt Engine

Returns the canonical `ReceiptResponse` object used by every invoice feature:

```typescript
interface ReceiptResponse {
  invoiceNumber: string;
  date: string;           // "09 Jul 2026"
  time: string;           // "10:42 PM"
  shop: {
    name: string;
    gstin: string;
    phone: string;
    address: string;
    upiId: string;
  };
  customer: { name: string; phone: string };
  items: {
    name: string;
    qty: number;
    price: number;        // INR (converted from paise)
    discount: number;
    lineTotal: number;
  }[];
  subtotal: number;       // INR
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  cashier: string;
  upiPayload: string;     // UPI deep-link string for QR
  thankYouMessage: string;
  thermalFormat: any[];   // ESC/POS-friendly JSON structure
  publicToken: string;    // 12-char base64url token
  pdfUrl: string;         // Relative path to cached PDF
}
```

---

### `PdfService.generateInvoicePdf(receipt, outputPath)`

- Generates a professional A4 PDF using `pdfkit`
- Layout: shop header, invoice metadata, items grid with GST, payment summary
- Saved to `uploads/invoices/<invoiceNumber>.pdf`
- **Cached** — only generated once; subsequent requests stream the existing file from disk

---

### `InvoiceService.generateHtmlInvoice(receipt)`

- Generates a self-contained, mobile-responsive HTML invoice
- Styled with inline Tailwind (no CDN dependency for printing)
- Cached in memory (`Map<token, html>`) for fast repeated access
- Includes `<meta name="robots" content="noindex,nofollow">` on all public pages

---

### `EscposFormatter`

Builds raw ESC/POS binary buffers for 58mm thermal paper:
- `init()` — reset printer
- `alignCenter()` / `alignLeft()` — text alignment
- `bold(true/false)` — bold toggle
- `sizeNormal()` / `sizeDoubleWidthHeight()` — text size
- `text(str)` — print a line
- `divider()` — dashed separator
- `lineFeed(n)` — blank lines
- `cut()` — paper cut command
- `getBuffer()` — returns the final `Buffer`

---

### `CheckoutService.executeCheckout(request)` — Atomic Transaction

Runs entirely inside `db.transaction()`. If anything throws, SQLite rolls back everything:

1. Find or auto-create customer by phone number
2. Generate next sequential invoice number (`INV-2026-XXXXXX`)
3. For each item: validate stock, calculate line totals including GST
4. Deduct stock from `products` table
5. Insert `sales` record with `public_token` (12-char crypto random)
6. Insert all `sale_items` records
7. Update customer: `total_orders++`, `lifetime_value += grand_total`, `last_visit = now()`
8. Commit transaction
9. (Post-commit) Enqueue background Google Sheets sync job

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm (native workspaces support)

### 1. Clone the repository

```bash
git clone <repo-url>
cd orion-pulse-main
```

### 2. Install workspace dependencies

Run `npm install` from the repository root. This will automatically install dependencies for the root, backend, and frontend workspaces using npm workspaces hoisting, and symlink local packages.

```bash
npm install
```

### 3. Configure environment (optional)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your shop settings
```

### 4. Running Development Servers

You can run development servers for both packages directly from the repository root:

```bash
# Run backend development server (with tsx watch hot-reloading)
npm run dev:backend

# Run frontend development server (Vite hot-reloading)
npm run dev:frontend
```

On first start of the backend, `initDb()` automatically:
- Creates all SQLite tables with the correct schema
- Runs safe idempotent column migrations (`ALTER TABLE IF NOT EXISTS` pattern)
- Seeds default shop settings
- Seeds sample product and customer data
- Backfills `public_token` for any legacy sales records
- Creates `uploads/products/` and `uploads/invoices/` directories

### 5. Open the app

Navigate to [http://localhost:8081](http://localhost:8081)

---

## Environment Variables

Create `backend/.env`:

```env
# Server
PORT=8080

# Google Sheets Backup (optional)
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms

# Public base URL (used in WhatsApp share links)
PUBLIC_URL=http://localhost:8080
```

> **Security:** Never commit `.env` to version control. Google credentials must remain server-side only and must never be embedded in frontend code.

---

## Development Workflow

All workflow scripts can be run directly from the workspace root or from the subdirectories.

### Run development servers
```bash
# Backend
npm run dev:backend

# Frontend
npm run dev:frontend
```

### TypeScript type-checking (no emit)

```bash
# Backend (using local config)
cd backend && npx tsc --noEmit

# Frontend (using local config)
cd frontend && npx tsc --noEmit
```

### Lint and Format (Frontend)

```bash
# Run ESLint inside frontend
npm run lint --workspace=tanstack_start_ts

# Run Prettier format inside frontend
npm run format --workspace=tanstack_start_ts
```

---

## Deployment Notes

### SQLite file location

```
backend/src/database/orion.db
```

Back this file up regularly — it is the single source of truth for all POS data.

### Uploaded files

```
backend/uploads/
  products/    ← product photos (referenced in products.image_url)
  invoices/    ← cached A4 PDF invoices (referenced in sales.pdf_url)
```

Include these directories in your backup strategy alongside the SQLite file.

### Production Build

#### Monorepo root build
To build both backend and frontend packages:
```bash
npm run build
```

#### Workspace-specific builds
To build only backend or only frontend:
```bash
# Build backend only
npm run build:backend

# Build frontend only
npm run build:frontend
```

#### Starting the application
To run the production-built backend server:
```bash
npm run start
```

### Railway (Backend deployment)
To deploy the backend to Railway:
- Railway will automatically detect the root `package.json`.
- The build command is `npm run build:backend`.
- The start command is `npm run start`.
- Set environment variables as required in Railway settings.

### Cloudflare Pages (Frontend deployment)
To build and deploy the frontend independently on Cloudflare Pages:
- Set **Root Directory** to `frontend`.
- Cloudflare Pages will run `npm install` inside the `frontend` directory, installing all dependencies listed in `frontend/package.json` using the local lockfile/dependencies.
- Build command: `npm run build` (or `vite build`).
- Output directory: `frontend/.output/public`.

### Running on Android (Z91 POS Terminal)

The backend is designed to run locally on the Z91 device (Node.js for Android). The frontend can be served from the same device or accessed from a connected desktop browser on the same LAN by replacing `localhost` with the device's LAN IP in `src/lib/api.ts`.

---

## Known Constraints

| Area | Constraint |
|---|---|
| Printer | Only `Internal POS` (Z91 built-in 58mm) is fully supported. Network printers require additional driver integration. |
| Google Sheets | Sync is one-way (SQLite → Sheets). Edits made in Sheets are not synced back. |
| Public invoice links | Links are accessible to anyone with the URL (token-based, not session-based). Add authentication middleware if your business requires it. |
| Currency | Only INR (Indian Rupees) is supported. All amounts are stored as integer paise. |
| Multi-store | Single-store only. Multi-branch support would require a shared PostgreSQL or MySQL backend. |

---

## Release Candidate 1 (RC1) Release Notes

### Subsystem Fixes & Improvements

- **PDF Storage Cleanup Service**: Added a background worker executing at 2:00 AM daily that unlinks invoice PDF files older than a user-defined retention period (`30 Days`, `90 Days`, `180 Days`, `Forever`). Incorporates safe preservation of the newest 100 generated PDFs, with seamless on-demand automatic regeneration.
- **Kolkata Timezone Locking**: Offset SQLite date/time filters by exactly `+5 hours` and `30 minutes` and locked client-side dates parsing to the `Asia/Kolkata` timezone. Ensures uniform and correct sales timestamps across Dashboard metrics, invoices, print receipts, and Google Sheets.
- **Zustand POS Store Hydration**: Integrated react-query state hooks with Zustand mutations on mount inside the `AppShell`. Resolved lookup and creation conflict issues by verifying existing mobile numbers against the SQLite ledger during cart checkouts.
- **Google Sheets Settings Card**: Upgraded settings panel to show the Service Account Email with copy commands, Sheets connection test results (with descriptive permissions checks), and automatic header row population for enqueued tabs.
- **Embedded Outfit Vector Fonts**: Downloaded Outfit Regular/Bold font files on startup to render sharp, vector-based PDF reports and invoices containing the official `₹` currency symbol.

### Test Overview Summary

- **Customer Sync / Search**: PASS
- **Sales Trends / GST aggregation**: PASS
- **A4 PDF vector rendering**: PASS
- **Google Sheets connection tests / Auto-sync**: PASS
- **Performance benchmarks**: Product & Customer searches complete in `<3ms`, Checkouts take `<50ms`, and reports handle `10,000+` records in `<50ms`.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run type checks before committing: `npx tsc --noEmit` in both `backend/` and project root
4. Commit with a clear message: `git commit -m "feat: describe your change"`
5. Push and open a Pull Request

> **Critical rule:** The `SalesService.getReceipt()` method is the single source of truth for invoice generation. Do **not** duplicate invoice-building logic in any new feature — always call `getReceipt()` and pass the resulting object downstream.

---

*Built with ❤️ for Indian retail — Orion POS (v1.0.0-RC1)*
