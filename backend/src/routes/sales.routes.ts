import { Router } from "express";
import { SalesController } from "../controllers/sales.controller";
import { ReturnController } from "../controllers/return.controller";

const router = Router();
const controller = new SalesController();
const returnController = new ReturnController();

// GET today's sales (MUST be defined before GET /:id)
router.get("/today", controller.getToday);

// GET sale by invoice number (MUST be defined before GET /:id)
router.get("/invoice/:invoice", controller.getByInvoice);

// GET all sales
router.get("/", controller.getAll);

// GET receipt by sale ID/invoice
router.get("/:id/receipt", controller.getReceipt);

// POST print receipt
router.post("/:id/print", controller.printReceipt);

// GET WhatsApp receipt share link
router.get("/:id/share/whatsapp", controller.getWhatsAppShareLink);

// GET PDF receipt by sale ID/invoice
router.get("/:id/pdf", controller.getPdfReceipt);

// POST process sale return
router.post("/:id/return", returnController.processReturn);

// GET sale returns list
router.get("/:id/returns", returnController.getReturnsBySale);

// GET sale by ID
router.get("/:id", controller.getById);

export default router;
