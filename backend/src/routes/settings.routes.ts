import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { SettingsController } from "../controllers/settings.controller";

const router = Router();
const controller = new SettingsController();

// Configure multer for database uploads
const tempDir = path.join(__dirname, "../../uploads/temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
const upload = multer({ dest: tempDir });

router.get("/", controller.getAll);
router.post("/", controller.update);
router.get("/storage", controller.getStorageStatus);
router.post("/storage/cleanup", controller.triggerCleanup);
router.get("/backup", controller.backup);
router.post("/restore", upload.single("backup"), controller.restore);

export default router;
