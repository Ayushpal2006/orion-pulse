# Mobile Development Architecture

## Planned Architecture

### Existing Production

```
frontend
    ↓
Cloudflare

backend
    ↓
Render

backend
    ↓
Neon PostgreSQL
```

### Future Mobile Architecture

```
mobile
    ↓
Local SQLite
    ↓
Sync Engine
    ↓
Existing REST API
    ↓
Neon PostgreSQL
```

> **Important Constraint**: The mobile application must NOT directly access Neon PostgreSQL.
