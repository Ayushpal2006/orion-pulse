import { Router } from "express";
import { BackupController } from "../controllers/backup.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new BackupController();

router.post("/create", authorize("admin", "manager"), controller.createBackup);
router.get("/history", authorize("admin", "manager"), controller.getHistory);
router.post("/restore", authorize("admin", "manager"), controller.restoreBackup);

export default router;
