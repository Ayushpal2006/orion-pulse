import { Router } from "express";
import { ReportsController } from "../controllers/reports.controller";

const router = Router();
const controller = new ReportsController();

router.get("/", controller.getReports);

export default router;
