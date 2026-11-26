import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { adminAuthMiddleware } from "../middleware/admin-auth.middleware";
import { env } from "../config/env";

const router = Router();
const controller = new AdminController();

// POST /api/admin/reset-demo-data
// Truncates sales/products/customers for EVERY tenant. Never available in production.
router.post(
  "/reset-demo-data",
  (_req, res, next) => (env.NODE_ENV === "production" ? res.status(404).json({ success: false, error: "Not found" }) : next()),
  adminAuthMiddleware,
  controller.resetDemoData,
);
router.get("/metrics", adminAuthMiddleware, controller.getMetrics);

export default router;
