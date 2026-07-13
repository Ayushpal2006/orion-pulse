# Deployment Report — Orion POS v1.0 Stable

This report documents the deployment settings for stable Version 1.0.

---

## 1. Railway Backend Deployment
- **Database Connection**: Target PostgreSQL database loaded dynamically from the `DATABASE_URL` environment variable.
- **Port Handling**: Server automatically binds to the `$PORT` environment variable assigned by Railway.
- **Environment variables**:
  - `PORT`: Auto-assigned by Railway.
  - `DATABASE_URL`: Production PostgreSQL pool url.
  - `JWT_SECRET`: Standard secret key.
  - `ADMIN_EMAIL`: Admin email seed.
  - `ADMIN_PASSWORD`: Admin password seed.
- **Startup script**: Runs programmatic migrations (`npx drizzle-kit generate` / `src/database/init.ts`) on boot.

## 2. Cloudflare Pages Frontend Deployment
- **Vite config**: Compiles React 19 source code cleanly.
- **Output files**: Saved to `dist/public`.
- **Environment bindings**:
  - `API_URL`: Targets the Railway API domain (e.g. `https://orion-pos.up.railway.app`).
