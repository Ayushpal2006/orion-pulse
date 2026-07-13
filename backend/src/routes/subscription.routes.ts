import { Router } from "express";
import { SubscriptionController } from "../controllers/subscription.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const controller = new SubscriptionController();

router.get("/plan", authenticate(), controller.getPlan);
router.post("/webhook", controller.webhook); // Public endpoint for Razorpay webhooks

export default router;
