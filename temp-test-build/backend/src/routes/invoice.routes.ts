import { Router } from "express";
import { InvoiceController } from "../controllers/invoice.controller";

const router = Router();
const controller = new InvoiceController();

router.get("/v/:token", controller.renderPublicInvoice);
router.get("/v/:token/download", controller.downloadPublicInvoice);

export default router;
