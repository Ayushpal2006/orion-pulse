import { Request, Response, NextFunction } from "express";
import { CheckoutService } from "../services/checkout.service";
import { CheckoutRequestSchema } from "../validation/checkout.validation";

export class CheckoutController {
  private service: CheckoutService;

  constructor() {
    this.service = new CheckoutService();
  }

  checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate the checkout request parameters
      const parsedBody = CheckoutRequestSchema.parse(req.body);
      const result = await this.service.executeCheckout(parsedBody as any);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
