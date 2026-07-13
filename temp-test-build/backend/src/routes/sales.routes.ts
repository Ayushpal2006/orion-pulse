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

// GET receipt by sale ID/invoice
router.get("/:id/receipt", controller.getReceipt);

// POST print receipt
router.post("/:id/print", controller.printReceipt);

// GET WhatsApp receipt share link
router.get("/:id/share/whatsapp", controller.getWhatsAppShareLink);

// GET PDF receipt by sale ID/invoice
router.get("/:id/pdf", controller.getPdfReceipt);

// GET sale by ID
router.get("/:id", controller.getById);


export default router;
