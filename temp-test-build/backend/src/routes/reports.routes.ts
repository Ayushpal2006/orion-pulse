import { Router } from "express";
import { ReportsController } from "../controllers/reports.controller";

const router = Router();
const controller = new ReportsController();

router.get("/", controller.getReports);
router.get("/pdf", controller.exportPdf);
router.get("/excel", controller.exportExcel);

export default router;
