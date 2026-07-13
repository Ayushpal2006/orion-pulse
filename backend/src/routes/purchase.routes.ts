import { Router } from "express";
import { PurchaseController } from "../controllers/purchase.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new PurchaseController();

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authorize("admin", "manager"), controller.create);
router.post("/:id/receive", authorize("admin", "manager"), controller.receive);

export default router;
