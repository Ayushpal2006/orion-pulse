# Deployment Guide — Orion POS

This document details Railway and Cloudflare Pages configuration.

## 1. Railway Production Backend Configuration
- **Database URL**: Configure `DATABASE_URL` as a PostgreSQL connection string pool.
- **Port Binding**: Railway dynamically binds the server to the `$PORT` environment variable.
- **Environment variables list**:
  - `PORT`: (Auto-bound by Railway)
  - `DATABASE_URL`: (Connection String)
  - `JWT_SECRET`: (Secure random hash string)
  - `ADMIN_EMAIL`: `admin@orion.com`
  - `ADMIN_PASSWORD`: (Secure password)
- **Start command**: `npm run start` (Preceded by `npm run build` to compile code to the `dist` folder).
- **Health Check Path**: `/health` (Monitored by Railway for auto-restarts).

## 2. Cloudflare Pages Frontend Configuration
- **Build tool**: vite build.
- **Output Directory**: `dist/public`.
- **Environment Variables**:
  - `API_URL`: Backend service domain (e.g. `https://orion-backend.up.railway.app`).
