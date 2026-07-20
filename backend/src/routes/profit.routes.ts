import { Router } from "express";
import { ProfitController } from "../controllers/profit.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new ProfitController();

// GET endpoints — all authenticated roles
router.get("/summary", controller.getSummary);
router.get("/dashboard", controller.getDashboard);
router.get("/products", controller.getProducts);
router.get("/trends", controller.getTrends);
router.get("/reports", controller.getFullReport);

// Sales breakdown — Admin + Manager only (shows invoice-level profitability)
router.get("/sales", authorize("admin", "manager"), controller.getSales);

// Exports — Admin + Manager only
router.get("/export/excel", authorize("admin", "manager"), controller.exportExcel);
router.get("/export/csv", authorize("admin", "manager"), controller.exportCsv);
router.get("/export/pdf", authorize("admin", "manager"), controller.exportPdf);

export default router;
