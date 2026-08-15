# Mobile Local Database Layer (Planned Phase 2)

## Architectural Principle
> [!IMPORTANT]
> **The mobile application must NEVER connect directly to Neon PostgreSQL.**
>
> The flow must always be:
> **React Native Client → REST API → Existing Backend → Neon PostgreSQL**

---

## Planned Capabilities (Phase 2)
1. **Local SQLite Engine**: Fast, local relational storage on the Android device for instant POS interactions (products, inventory snapshot, customer records, drafts).
2. **Offline-First Transactions**: Ability to create and save bills locally even when network connectivity is lost.
3. **Optimistic UI Updates**: Immediate response times for high-volume retail checkout lanes.

---

## Phase 1 Status
- **SQLite implementation**: Not implemented in Phase 1 (stub layer only).
