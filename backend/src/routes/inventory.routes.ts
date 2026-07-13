import { Router } from "express";
import { InventoryController } from "../controllers/inventory.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new InventoryController();

router.post("/adjust", authorize("admin", "manager"), controller.adjust);
router.get("/reorder-suggestions", controller.getReorderSuggestions);
router.get("/valuation", authorize("admin", "manager"), controller.getValuation);

export default router;
