import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { adminAuthMiddleware } from "../middleware/admin-auth.middleware";

const router = Router();
const controller = new AdminController();

// POST /api/admin/reset-demo-data
router.post("/reset-demo-data", adminAuthMiddleware, controller.resetDemoData);
router.get("/metrics", adminAuthMiddleware, controller.getMetrics);

export default router;
