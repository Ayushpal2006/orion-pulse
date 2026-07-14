import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { SettingsController } from "../controllers/settings.controller";

const router = Router();
const controller = new SettingsController();

// Configure multer for database uploads (matching field name "database")
const tempDir = path.join(__dirname, "../../uploads/temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
const upload = multer({ dest: tempDir });

// GET    /settings/database/backup -> Streams SQL backup file download
router.get("/backup", controller.backup);

// POST   /settings/database/backup -> Generates SQL backup and returns download JSON metadata
router.post("/backup", controller.backup);

// POST   /settings/database/restore -> Restores database from uploaded SQL file
router.post("/restore", upload.single("database"), controller.restore);

export default router;
