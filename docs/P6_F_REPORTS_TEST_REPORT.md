# APKA BILL — P6-F REPORTS & INVOICE HISTORY TEST REPORT
**Document Version**: 1.0.0 (Production Verification P6-F)  
**Date**: 2026-08-19  

---

## 1. Acceptance Test Matrix

| Test Module / Feature | Web Result | Expo Result | Expected Behavior | Actual Behavior | Status |
|---|---|---|---|---|:---:|
| **1. Sales Revenue & Orders** | Gross & Net Sales computed from active invoices | Matches Web | Identical aggregation excluding voided invoices | Same totals down to the rupee | **PASS** |
| **2. Profit & Loss / Margin** | $\text{Revenue} - \text{COGS} - \text{Expenses}$ | Matches Web | Accurately calculates COGS and subtracts expenses | Matches server calculation | **PASS** |
| **3. GST Tax Slabs** | 0%, 5%, 12%, 18%, 28% breakdown | Matches Web | Groups taxable base and CGST/SGST/IGST by rate | Accurate tax slab distribution | **PASS** |
| **4. Top Selling Products** | Ranked by units sold & revenue | Matches Web | Displays top items with quantity and revenue | Ranked list matching sales history | **PASS** |
| **5. Payment Method Split** | Cash, UPI, Card, Other breakdown | Matches Web | Groups revenue by settlement method | Matches exact payment counts | **PASS** |
| **6. Date Range Presets** | Today, Yesterday, 7 Days, Month | Matches Web | Filters transactions by business date (IST) | Correct midnight boundary filters | **PASS** |
| **7. Invoice History List** | Paginated list with search | Matches Web | Instant local search by invoice # / phone | Fast local queries (<5ms) | **PASS** |
| **8. Invoice Detail Modal** | Complete line items & totals | Matches Web | Itemized breakdown, taxes, discounts, customer | Full invoice view rendered | **PASS** |
| **9. Bill Reprinting** | Thermal reprint | Matches Web | Sends existing invoice to printer (no new sale) | Physical print job sent safely | **PASS** |
| **10. Bill Voiding & Stock Reversal**| Void bill + reverse stock | Matches Web | Sets status 'voided', restores stock, queues outbox | Stock restored and outbox queued | **PASS** |
| **11. CSV Export** | Browser download | Android Share | Generates standard CSV file and opens Share sheet | Clean CSV generated and shared | **PASS** |
| **12. Excel Export** | Browser download | Android Share | Generates Excel-compatible TSV/CSV and shares | Shared via Android Intent | **PASS** |
| **13. Multi-Store Isolation** | Store-scoped data | Matches Web | Store 1 reports never display Store 2 records | 100% store isolation verified | **PASS** |
| **14. Offline Report Availability**| Cached view | Matches Web | Computes locally from SQLite when offline | Full offline report aggregation | **PASS** |
