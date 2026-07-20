import { Router } from "express";
import { StockAdjustmentController } from "../controllers/stock-adjustment.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new StockAdjustmentController();

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authorize("admin", "manager"), controller.create);

export default router;
