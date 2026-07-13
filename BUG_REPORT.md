# Bug Report — Orion POS v1.0 Stable

This report documents the status of critical bugs and verified resolutions.

---

## 🟢 Critical Bugs Resolved (0 Outstanding)

### 1. Custom Date Range Filters (Fixed)
- **Problem**: Selecting a custom date range in the dashboard reports resulted in SQL execution crashes.
- **Fix**: Replaced SQLite date logic with PostgreSQL raw queries (`timezone('Asia/Kolkata', created_at)::date`).

### 2. Negative Inventory Levels (Fixed)
- **Problem**: Concurrent checkout orders allowed products' stock levels to go below zero.
- **Fix**: Wrapped checkout deductions inside transactional locks (`db.transaction` with `.for("update")` selectors), verifying stock availability before reducing.

### 3. Autoincrement Restart Reset (Fixed)
- **Problem**: Factory reset integration tests failed due to sequence conflicts in PostgreSQL.
- **Fix**: Rewrote the integration test seeds to clear tables in correct foreign key constraints sequence and verify clean PostgreSQL indexes.
