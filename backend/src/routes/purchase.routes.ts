import { Router } from "express";
import { PurchaseController } from "../controllers/purchase.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new PurchaseController();

router.get("/", controller.getAll);
router.get("/:id/pdf", controller.getPdf);
router.get("/:id/share/whatsapp", controller.getWhatsAppShareLink);
router.get("/:id", controller.getById);
router.post("/", authorize("admin", "manager"), controller.create);
router.post("/:id/void", authorize("admin", "manager"), controller.voidPurchase);
router.put("/:id", authorize("admin", "manager"), controller.update);
router.delete("/:id", authorize("admin"), controller.delete);

export default router;
