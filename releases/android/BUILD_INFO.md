# Apka Bill POS — Capacitor Android Mobile Build Report

> **Engineered By:** Senior Android & Capacitor Engineering Team  
> **Build Date:** 2026-11-15 17:31 IST / 12:01 UTC  
> **Environment:** macOS Darwin (arm64), OpenJDK 21, Gradle 8.14.3, Android SDK 36.0.0  

---

## 1. Project Specifications

| Property | Value |
| :--- | :--- |
| **Capacitor Project Root** | `orion-pulse/frontend` |
| **Android Application Root** | `orion-pulse/frontend/android/app` |
| **Capacitor Version** | `8.5.0` (`@capacitor/android`, `@capacitor/core`, `@capacitor/cli`) |
| **Application ID (Package ID)** | `com.apkabill.pos` |
| **App Display Name** | `Apka Bill` |
| **Version Name** | `1.0.0` |
| **Version Code** | `1` |
| **Min SDK** | `24` (Android 7.0 Nougat+) |
| **Target SDK / Compile SDK** | `36` (Android 16) |
| **Configured API URL** | `https://orion-pos-api.ayushpalworkplace2006.workers.dev` (Production Cloudflare Worker) |
| **Localhost URLs in Bundle** | `0` (Fully purged & sanitized) |
| **Vite Static SPA Shell** | `dist-capacitor/client/index.html` |

---

## 2. Generated Build Artifacts

Artifacts are saved and preserved in both `orion-pulse/releases/android/` and `releases/android/`:

| Artifact | File Name | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **Debug APK** | `apkabill-pos-debug-v1.0.0.apk` | **7.4 MB** (7,765,199 bytes) | `ee606b1dc64a9eefc6c16fe5b649d98da81c4eeabf059703abef6421cf0e0318` |
| **Release APK** (Unsigned) | `apkabill-pos-release-unsigned-v1.0.0.apk` | **5.7 MB** (5,940,893 bytes) | `081f56c152a976a8689c443b2423351956c1f047ad7efa9e465d33df0da500cd` |
| **Release AAB** (Play Store) | `apkabill-pos-release-v1.0.0.aab` | **5.5 MB** (5,761,584 bytes) | `e9e1be6d4617524f9674ccb28c09d97546240bbc8434ea40f4b87e94ed1923da` |

---

## 3. Verification & Quality Gates

### A. TypeScript Verification
* **Command:** `cd frontend && ../node_modules/.bin/tsc --noEmit`
* **Result:** **PASS (0 errors)**

### B. Unit Test Suites
* **Frontend Test Matrix (`bun test frontend/src/lib/__tests__/`)**: **22 / 22 PASSED**
  - `whatsapp-share.test.ts`: **10 / 10 passed** (Sanitizes URLs, formats currency in INR, excludes localhost)
  - `printer-settings-matrix.test.ts`: **9 / 9 passed** (Validates logo, UPI QR, and barcode toggles)
  - `offline-sync-payload.test.ts`: **3 / 3 passed** (Prevents double-scaling of integer paise)
* **Financial Amount Scale Matrix (`node scripts/verify-amount-scale-fix.mjs`)**: **10 / 10 PASSED**

### C. Capacitor SPA Build & Sync
* **Command:** `CAPACITOR_BUILD=1 vite build && npx cap sync android`
* **Result:** **SUCCESS**
  - Prerendered static client SPA shell with entry point at `android/app/src/main/assets/public/index.html`.
  - Service worker registration skipped automatically on native platform to guarantee zero stale bundle caching.

### D. Gradle Compilation
* **Command:** `./gradlew assembleDebug assembleRelease bundleRelease --no-daemon`
* **Result:** **BUILD SUCCESSFUL in 15s** (223 actionable tasks).

---

## 4. Native Plugins & Android Configuration

### 1. `MainActivity.java`
* Pre-registers native plugins before `super.onCreate()`:
  - `ThermalPrinterPlugin.class`
  - `InvoiceSharePlugin.class`

### 2. `ThermalPrinterPlugin.java`
* Implements direct hardware thermal printing via `ESCPOS-ThermalPrinter-Android:3.3.0`:
  - **Bluetooth Thermal Printers:** Prioritizes bonded and DantSu imaging devices; dynamically requests `BLUETOOTH_CONNECT` and `BLUETOOTH_SCAN` on Android 12+ (API 31+).
  - **USB & Network Printers:** Direct USB vendor communication and TCP socket streaming.
  - **Z91 POS Device Compatibility:** Built-in serial node fallback (`/dev/ttyS1`, `/dev/ttyS0`, `/dev/ttyMT0`).
  - **Z91 Testing Status:** Generic Bluetooth SPP and DantSu ESC/POS engine are compiled and verified. Physical Z91 internal serial / AIDL hardware validation remains pending until a physical Z91 device is connected.

### 3. `InvoiceSharePlugin.java`
* Native Android sharing using `androidx.core.content.FileProvider`:
  - Directly attaches temporary generated PNG invoice images.
  - Queries `com.whatsapp` and `com.whatsapp.w4b` package visibility for instant WhatsApp conversation launch or native share sheet fallback.

### 4. Permissions Audited in `AndroidManifest.xml`
* `android.permission.INTERNET`
* `android.permission.ACCESS_NETWORK_STATE`
* `android.permission.BLUETOOTH` & `BLUETOOTH_ADMIN` (maxSdkVersion=30)
* `android.permission.BLUETOOTH_CONNECT` & `BLUETOOTH_SCAN` (Android 12+)
* `androidx.core.content.FileProvider` (`${applicationId}.fileprovider`)
* Zero unnecessary permissions requested (no SMS, no Contacts, no Background Location).

---

## 5. Physical Device & Emulator Status

* **ADB Devices Connected:** `0` (No physical Android device was connected via USB during this build).
* **Android Emulator:** No GUI AVD emulator is configured on this headless build machine.
* **Installation Instructions:**
  To install the Debug APK on any connected Android phone or POS device:
  ```bash
  adb install -r releases/android/apkabill-pos-debug-v1.0.0.apk
  ```

