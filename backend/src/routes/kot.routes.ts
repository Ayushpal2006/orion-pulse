import { Router } from "express";
import { kotController } from "../controllers/kot.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const canOperateKot = authorize("admin", "manager", "cashier", "superadmin");

router.get("/", canOperateKot, kotController.getAll);
router.get("/sale/:saleId", canOperateKot, kotController.getBySaleId);
router.get("/:id", canOperateKot, kotController.getById);
router.patch("/:id/status", canOperateKot, kotController.updateStatus);
router.post("/:id/reprint", canOperateKot, kotController.reprint);

export default router;
