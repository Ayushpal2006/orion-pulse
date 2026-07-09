import { Router } from "express";
import { SalesController } from "../controllers/sales.controller";

const router = Router();
const controller = new SalesController();

// GET today's sales (MUST be defined before GET /:id)
router.get("/today", controller.getToday);

// GET sale by invoice number (MUST be defined before GET /:id)
router.get("/invoice/:invoice", controller.getByInvoice);

// GET all sales
router.get("/", controller.getAll);

// GET sale by ID
router.get("/:id", controller.getById);

export default router;
