# Changelog - Orion POS

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-07-13

### Added
- **SaaS Tenancy Controls**: Created `organizations` and `organization_invitations` modules. Added custom token verification for accept paths.
- **Support Tickets & API Keys**: Added Drizzle tables and Express routers to support external keys integrations and support ticketing.
- **AI Copilot prompt query**: Created `/api/ai/copilot/query` endpoint with smart heuristics answering inventory, sales prediction, and customer CRM prompts.
- **Super Admin Dashboard widgets**: Added `/api/admin/metrics` endpoint reporting database sizes, tenant organizations counts, active users.

### Modified
- **PostgreSQL schema**: Upgraded `src/db/schema.ts` to include Phase 8-10 database schemas.
- **Integration Tests**: Rewrote `backend/src/test-reset.ts` for PostgreSQL compatibility (renamed datetime function to NOW() and cleared inventory logs).
