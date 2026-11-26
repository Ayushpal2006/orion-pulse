# Play Store readiness — Apka Bill (Capacitor Android app)

Status as of 2026-11-26. Based on the actual manifest, Gradle config and source, not assumptions.

## Build facts

| Item | Value | Source |
|---|---|---|
| Build path | Capacitor (static SPA in `frontend/dist-capacitor`) | `frontend/capacitor.config.ts`. Expo (`mobile-expo/`) stays as fallback, not the release path. |
| Package / applicationId | `com.apkabill.pos` | `frontend/android/app/build.gradle` |
| versionCode / versionName | 1 / 1.0.0 | same |
| minSdk / targetSdk / compileSdk | 24 / 36 / 36 | `frontend/android/variables.gradle` |
| Network | HTTPS only; cleartext only for localhost/emulator | `res/xml/network_security_config.xml` |
| Backup | `allowBackup="false"` | manifest |
| Third-party SDKs | Capacitor only. No ads, analytics, crash reporting or tracking SDKs. | `package.json`, `capacitor.settings.gradle` |
| API | `https://orion-pos-api.ayushpalworkplace2006.workers.dev` (baked in from `frontend/.env.production`) | build |

**Decide before the first upload:** the package name is permanent on Google Play. It is `com.apkabill.pos` today; earlier plans mentioned `com.apkabill.mobile`. Changing it after publishing means a new app listing.

## Permissions and why

| Permission | Why | Notes |
|---|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | Sync with the server; detect offline mode | |
| `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` (Android 12+) | Find and connect to Bluetooth thermal receipt printers | `BLUETOOTH_SCAN` is declared `neverForLocation` |
| `BLUETOOTH`, `BLUETOOTH_ADMIN` (Android ≤ 11) | Same, older Android | `maxSdkVersion=30` |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (Android ≤ 11 only) | Android 11 and older require location permission to scan for Bluetooth devices | `maxSdkVersion=30`; the app never reads location |
| `<queries>` for `com.whatsapp`, `com.whatsapp.w4b` | Open WhatsApp directly when sharing a bill | Package visibility only |

## Signing plan (needs owner approval before any key is created)

1. Enrol in **Play App Signing** (Google holds the app signing key; you hold only an upload key, which Google can reset if lost).
2. Create the upload key on the owner's machine: `keytool -genkeypair -v -keystore upload.keystore -alias apkabill-upload -keyalg RSA -keysize 4096 -validity 10000`
3. Store the keystore and both passwords in a password manager **and** an offline backup (USB drive kept separately). Never email it, never commit it.
4. Create `frontend/android/keystore.properties` (git-ignored) with `storeFile`, `storePassword`, `keyAlias`, `keyPassword`; `app/build.gradle` already reads it.
5. Build the bundle: `cd frontend && npm run build:capacitor && npx cap sync android && cd android && ./gradlew bundleRelease` (JDK 21 required).

`.gitignore` now excludes `*.jks`, `*.keystore`, `*.p12` and `keystore.properties`.

## Still needed from the owner

- Support email (shown on the listing and in the privacy policy).
- Where to host the privacy policy (a public URL is mandatory). Suggested: publish `privacy-policy.md` as a page on the existing site.
- The data deletion request contact (Play requires one for apps with accounts).
- Approval of the package name and the signing plan above.
- Phone screenshots: take from the release build on a real device (4–8 images, 1080×1920 or similar).
- Feature graphic 1024×500: can be cut from `marketing/video` (local) once the brand is final.

## Content rating (IARC questionnaire, expected answers)

Business/productivity utility. No violence, sexual content, gambling, drugs or user-to-user public communication. No location sharing. Expected rating: Everyone / 3+.
