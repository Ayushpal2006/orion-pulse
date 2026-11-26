import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { SettingsController } from "../controllers/settings.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new SettingsController();

const upload = multer({ storage: multer.memoryStorage() });

// Full-database backup/restore: same roles as /api/backup, never cashiers.
router.use(authorize("admin", "manager", "superadmin"));

// GET    /settings/database/backup -> Streams SQL backup file download
router.get("/backup", controller.backup);

// POST   /settings/database/backup -> Generates SQL backup and returns download JSON metadata
router.post("/backup", controller.backup);

// POST   /settings/database/restore -> Restores database from uploaded SQL file
router.post("/restore", upload.single("database"), controller.restore);

export default router;
