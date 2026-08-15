# Apka Bill Mobile (Android-First POS Client)

Apka Bill Mobile is the high-performance, Android-first React Native mobile client for the Apka Bill POS ecosystem.

---

## Architectural Principles

### 1. Backend REST Communication Boundary
> [!IMPORTANT]
> **The mobile application must NEVER connect directly to Neon PostgreSQL.**
>
> The flow must always be:
> **React Native Mobile Client → REST API → Existing Backend → Neon PostgreSQL**

### 2. Native Bare Workflow
- Built as a **bare React Native** application (NOT Expo managed) to allow low-level access to Android hardware APIs, POS OEM SDKs (Sunmi, iMin, Pax), USB/Bluetooth peripherals, and ESC/POS thermal printers.

---

## Directory Structure

```
mobile/
├── android/                   # Android native project (Gradle, Kotlin/Java, Manifest)
├── ios/                       # iOS native project structure
├── src/
│   ├── api/                   # REST API client abstraction (GET, POST, timeout, error handling)
│   ├── components/            # Reusable UI components (Buttons, Cards, Badges)
│   ├── config/                # Environment & configuration management (API_BASE_URL)
│   ├── db/                    # Local SQLite database layer (Planned Phase 2)
│   ├── native/                # Native hardware bridge abstractions (Printer, Scanner, USB, BT)
│   ├── navigation/            # Navigation placeholders & routing
│   ├── screens/               # Application screens (Initial DevScreen)
│   ├── services/              # Business domain services
│   ├── sync/                  # Background synchronization engine (Planned Phase 3)
│   ├── types/                 # TypeScript interfaces and type definitions
│   └── utils/                 # Utilities and helpers
├── App.tsx                    # Root React Native Component
├── index.js                   # Application Entry Point (AppRegistry)
├── metro.config.js            # Metro Bundler Configuration
├── tsconfig.json              # TypeScript Strict Configuration
└── package.json               # Mobile Client Dependencies & Scripts
```

---

## Development Setup

### Prerequisites
1. **Node.js**: >= 22
2. **Android SDK & JDK 17+**: Configured with `ANDROID_HOME` environment variable
3. **Android Device / Emulator**: Running Android API 24+

### Environment Configuration
Copy `.env.example` to `.env` or configure runtime `API_BASE_URL`:
```bash
# Android Emulator connects to host localhost via 10.0.2.2
API_BASE_URL=http://10.0.2.2:3000
```

### Running Locally

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies (if not already installed)
npm install

# Start Metro Bundler
npm run start

# Run on Android Emulator/Device
npm run android

# Run TypeScript Typecheck
npm run typecheck

# Run Linter
npm run lint
```

---

## Roadmap

| Phase | Milestone | Status |
| :--- | :--- | :--- |
| **Phase 1** | React Native Android Foundation, Architecture & Dev Screen | **COMPLETED** |
| **Phase 2** | Local SQLite Database & Offline-First POS Catalog | Planned |
| **Phase 3** | Background Delta Sync Engine & Conflict Resolution | Planned |
| **Phase 4** | Native Thermal Printer Integration (ESC/POS, Bluetooth, USB, Sunmi/iMin) | Planned |
| **Phase 5** | Hardware Barcode Scanner & Camera Interception | Planned |
