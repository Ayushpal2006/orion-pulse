import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { SettingsController } from "../controllers/settings.controller";

const router = Router();
const controller = new SettingsController();

const upload = multer({ storage: multer.memoryStorage() });

// GET    /settings/database/backup -> Streams SQL backup file download
router.get("/backup", controller.backup);

// POST   /settings/database/backup -> Generates SQL backup and returns download JSON metadata
router.post("/backup", controller.backup);

// POST   /settings/database/restore -> Restores database from uploaded SQL file
router.post("/restore", upload.single("database"), controller.restore);

export default router;
