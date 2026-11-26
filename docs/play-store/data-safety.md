# Play Console "Data safety" — answers based on the code

Verify each answer again before submitting if the app changes.

**Does the app collect or share user data?** Yes, it collects data. It does not share data with third parties for their own purposes.

**Is all data encrypted in transit?** Yes (HTTPS only; `cleartextTrafficPermitted="false"`).

**Can users request deletion?** Yes, by contacting support (owner must provide the contact and honour requests).

| Data type (Play category) | Collected | Purpose | Optional? | Notes |
|---|---|---|---|---|
| Name, Email address, Phone number (Personal info) | Yes | Account management, App functionality | Required for account holders | Shop owner/staff accounts |
| Name, Phone, Email, Address of the shop's customers and suppliers (Personal info) | Yes | App functionality | Optional (walk-in sales need none) | Entered by the shop, stored for the shop's own records |
| Purchase history (Financial info) | Yes | App functionality | Required | Sales, purchases, expenses of the shop |
| Photos (logo, product images) | Only if the shop uploads them | App functionality | Optional | |
| Location | No | | | Location permission exists only for Bluetooth scanning on Android ≤ 11; location is never read |
| App activity, Device IDs, Crash logs, Diagnostics | No | | | No analytics or crash SDK |

**Processors (not "sharing" under Play's definition, but list in the privacy policy):** Cloudflare (hosting/API), Neon (database), and, only if a shop turns them on, Google Sheets sync and Cloudinary image hosting.
