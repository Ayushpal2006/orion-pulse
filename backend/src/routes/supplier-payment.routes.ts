import { Router } from "express";
import { SupplierPaymentController } from "../controllers/supplier-payment.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new SupplierPaymentController();

router.get("/", controller.getPayments);
router.get("/ledger/:supplierId", controller.getLedgerBySupplier);
router.get("/reports", controller.getSupplierReports);
router.post("/", authorize("admin", "manager"), controller.createPayment);

export default router;
