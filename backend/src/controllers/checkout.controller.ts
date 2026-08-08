import { Request, Response, NextFunction } from "express";
import { CheckoutService } from "../services/checkout.service";
import { GoogleSyncDispatcher } from "../services/google-sync-dispatcher.service";
import { getTenantContext } from "../db/context";

export class CheckoutController {
  private service: CheckoutService;

  constructor() {
    this.service = new CheckoutService();
  }

  checkout = async (req: Request, res: Response, NextFunction: NextFunction): Promise<void> => {
    const tControllerStart = performance.now();
    try {
      console.log("[Checkout Flow] Checkout Started");
      const offlineHeader = (req.headers["x-offline-id"] as string) || (req.headers["offline-id"] as string);
      const payload = {
        ...req.body,
        offlineIdentifier: req.body.offlineIdentifier || offlineHeader,
      };

      const result = await this.service.executeCheckout(payload);

      const tSyncStart = performance.now();
      // Non-blocking fire-and-forget Google Sync Event Dispatch
      GoogleSyncDispatcher.dispatchSyncEvent("SALE_CREATED", result, getTenantContext());
      const tSyncTime = performance.now() - tSyncStart;

      const tResponseStart = performance.now();
      res.status(201).json(result);
      const tResponseTime = performance.now() - tResponseStart;

      const tTotal = performance.now() - tControllerStart;
      const timings = (result as any).timings || {};

      console.log(`
==================================================
📊 CHECKOUT PERFORMANCE PROFILE BREAKDOWN
==================================================
1. Pre-Checkout Validation & Settings: ${timings.preCheck || "0.00"} ms
2. Customer Lookup / Create:           ${timings.customerLookup || "0.00"} ms
3. Invoice Number Generation:          ${timings.invoiceGen || "0.00"} ms
4. Product & Stock Deduction:          ${timings.inventoryDeduction || "0.00"} ms
5. Sale Record Insert:                 ${timings.saleInsert || "0.00"} ms
6. Audit Log Insert:                   ${timings.auditInsert || "0.00"} ms
7. Sale Items Batch Insert:            ${timings.itemsInsert || "0.00"} ms
8. Customer Profile Update:            ${timings.customerUpdate || "0.00"} ms
--------------------------------------------------
DB Transaction Total:                  ${timings.dbTransactionTotal || "0.00"} ms
--------------------------------------------------
9. Receipt Snapshot & WhatsApp Prep:   ${timings.receiptPrep || "0.00"} ms
10. Google Sync Dispatch Trigger:      ${tSyncTime.toFixed(2)} ms
11. Response Serialization & Sending:  ${tResponseTime.toFixed(2)} ms
--------------------------------------------------
TOTAL CHECKOUT DURATION:               ${tTotal.toFixed(2)} ms
==================================================
`);
    } catch (error) {
      console.error("[Checkout Flow] Error caught in controller:", error);
      NextFunction(error);
    }
  };
}
