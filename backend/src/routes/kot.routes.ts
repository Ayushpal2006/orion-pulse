import { Router } from "express";
import { kotController } from "../controllers/kot.controller";

const router = Router();

router.get("/", kotController.getAll);
router.get("/sale/:saleId", kotController.getBySaleId);
router.get("/:id", kotController.getById);
router.patch("/:id/status", kotController.updateStatus);
router.post("/:id/reprint", kotController.reprint);

export default router;
