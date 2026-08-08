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
    try {
      console.log("[Checkout Flow] Checkout Started");
      const offlineHeader = (req.headers["x-offline-id"] as string) || (req.headers["offline-id"] as string);
      const payload = {
        ...req.body,
        offlineIdentifier: req.body.offlineIdentifier || offlineHeader,
      };
      const result = await this.service.executeCheckout(payload);
      console.log("[Checkout Flow] Response Built");
      res.status(201).json(result);
      console.log("[Checkout Flow] Response Returned");

      // Non-blocking fire-and-forget Google Sync Event Dispatch
      GoogleSyncDispatcher.dispatchSyncEvent("SALE_CREATED", result, getTenantContext());
    } catch (error) {
      console.error("[Checkout Flow] Error caught in controller:", error);
      NextFunction(error);
    }
  };
}
