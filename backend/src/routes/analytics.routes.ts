import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";

const router = Router();
const controller = new AnalyticsController();

router.get("/sales", controller.getSales);
router.get("/profit", controller.getProfit);
router.get("/customers", controller.getCustomers);
router.get("/products", controller.getProducts);
router.get("/cashflow", controller.getCashflow);
router.get("/forecast", controller.getForecast);
router.get("/insights", controller.getInsights);
router.get("/kpis", controller.getKPIs);

export default router;
