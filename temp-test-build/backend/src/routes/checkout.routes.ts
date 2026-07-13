import { Router } from "express";
import { CheckoutController } from "../controllers/checkout.controller";
import { validate } from "../middleware/validation.middleware";
import { CheckoutRequestSchema } from "../validation/checkout.validation";

const router = Router();
const controller = new CheckoutController();

// POST checkout
router.post("/", validate(CheckoutRequestSchema), controller.checkout);

export default router;
