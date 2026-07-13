# Security Audit Report - Orion POS

This document reviews the security posture of Orion POS.

## 1. Authentication & Authorization
- **JWT tokens validation**: Added jwt sign/verify checks on every request.
- **RBAC guards**: Added `authorize("admin", "manager")` middleware mapping. Restricted write actions to authorized accounts.
- **Password hashing**: All user passwords are encrypted using bcrypt.

## 2. API Security
- **Helmet**: Helmet middleware headers are registered.
- **Input Validation**: Zod validators prevent negative stock checks and pricing errors.
- **API Keys**: Generated using secure cryptographically random hashes (`op_live_...`). Hashed before storing in the database.

## 3. Data Protection
- **Row-Level multi-tenancy**: Automatically filters queries by context store ID.
- **Safe Database Queries**: All Drizzle query statements are fully parameterized to protect against SQL injections.
