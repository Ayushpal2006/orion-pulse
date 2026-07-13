import { Request, Response, NextFunction } from "express";
import { CheckoutService } from "../services/checkout.service";

export class CheckoutController {
  private service: CheckoutService;

  constructor() {
    this.service = new CheckoutService();
  }

  checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.executeCheckout(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
