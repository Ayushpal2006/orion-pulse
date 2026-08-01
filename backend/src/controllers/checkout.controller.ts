import { Request, Response, NextFunction } from "express";
import { CheckoutService } from "../services/checkout.service";

export class CheckoutController {
  private service: CheckoutService;

  constructor() {
    this.service = new CheckoutService();
  }

  checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    } catch (error) {
      console.error("[Checkout Flow] Error caught in controller:", error);
      next(error);
    }
  };
}
