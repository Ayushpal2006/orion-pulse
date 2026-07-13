import { Router } from "express";
import { SupplierController } from "../controllers/supplier.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new SupplierController();

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", authorize("admin", "manager"), controller.create);
router.put("/:id", authorize("admin", "manager"), controller.update);
router.delete("/:id", authorize("admin", "manager"), controller.delete);

router.post("/:id/payments", authorize("admin", "manager"), controller.recordPayment);
router.get("/:id/ledger", controller.getLedger);

export default router;
