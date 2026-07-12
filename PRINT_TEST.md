# Print Testing Checklist & Verification Guide

This document outlines the validation steps and expected behavior for cross-platform web printing in Orion POS.

## Core Requirements Tested
1. **Normal Web Browser Detection**: `BrowserPrintAdapter` chosen automatically when running on web.
2. **Dialog Invocation**: Browser print dialog opens via `window.print()` when clicking "Print".
3. **No Bloat/Leaks**: The printed page contains only the invoice (no sidebar, header, navigation, dashboard, or dialog backdrop/buttons).
4. **Dimensions Selection**: Works seamlessly for both **58mm** (thermal roll) and **A4** (standard page) configurations.
5. **Printer Selection**: The browser system print dialog permits picking any installed printer.

---

## Step-by-Step Manual Verification

### Step 1: Verify State & Settings Layout
1. Navigate to **Settings** page (`/settings`).
2. Verify that **Paper width** displays three options: `58mm`, `80mm`, and `A4`.
3. Select `A4` and click save/sync settings.
4. Select `58mm` and click save/sync settings.

### Step 2: Test Browser Print Dialog from Checkout
1. Navigate to **Billing** page (`/billing`).
2. Add items to the cart and checkout using any payment method.
3. On successful checkout, the invoice popup will appear.
4. Click the **🖨️ Print** button.
5. **Verification**:
   - The browser-native print preview dialog should open immediately.
   - For `58mm`, page dimension setup should automatically scale/wrap for standard POS thermal receipt format.
   - For `A4`, the layout should switch to a professional two-column invoice sheet.
   - All standard controls (sidebar, dashboard content, checkout buttons) must be hidden from print preview.

### Step 3: Test Browser Print Dialog from Customers list
1. Navigate to **Customers** page (`/customers`).
2. Select any customer and look at their purchase history list.
3. Click the **Print Slip** button on a past invoice line.
4. **Verification**:
   - A loader message "Fetching receipt details..." should briefly appear.
   - The native print dialog should open automatically with the correct template (A4 vs 58mm depending on active settings).

---

## Platform Matrix Verification

Verify the behavior across the three targeted browsers:

| Test Case | Chrome | Microsoft Edge | Mozilla Firefox |
| :--- | :---: | :---: | :---: |
| **Print Dialog Opens** | [ ] Pass | [ ] Pass | [ ] Pass |
| **Print Preview A4 Layout** | [ ] Pass | [ ] Pass | [ ] Pass |
| **Print Preview 58mm Layout** | [ ] Pass | [ ] Pass | [ ] Pass |
| **No Sidebar/Nav Leaks** | [ ] Pass | [ ] Pass | [ ] Pass |
| **Printer Selection Allowed** | [ ] Pass | [ ] Pass | [ ] Pass |

---

## Future Compatibility (Android Z91 Terminal POS SDK)

To test the future compatibility behavior:
- Verify `PosPrintAdapter` exists as a placeholder in `src/lib/print-adapter.ts`.
- Ensure it preserves native wrapper compatibility by invoking the backend's printer service when executing in an Android WebView context.
