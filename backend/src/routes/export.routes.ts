import { Router } from "express";
import { ExportController } from "../controllers/export.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new ExportController();

router.get("/products", authorize("admin", "manager"), controller.exportProducts);
router.get("/suppliers", authorize("admin", "manager"), controller.exportSuppliers);
router.get("/sales", authorize("admin", "manager"), controller.exportSales);
router.get("/expenses", authorize("admin", "manager"), controller.exportExpenses);

export default router;
