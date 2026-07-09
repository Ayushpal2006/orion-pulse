import { Router } from "express";
import { CheckoutController } from "../controllers/checkout.controller";

const router = Router();
const controller = new CheckoutController();

// POST checkout
router.post("/", controller.checkout);

export default router;
