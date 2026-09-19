import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { SettingsController } from "../controllers/settings.controller";

const router = Router();
const controller = new SettingsController();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", controller.getAll);
router.post("/", controller.update);
router.put("/", controller.update);
router.patch("/", controller.update);
router.get("/storage", controller.getStorageStatus);
router.post("/storage/cleanup", controller.triggerCleanup);
router.get("/backup", controller.backup);
router.get("/database/backup", controller.backup);
router.post("/restore", upload.single("backup"), controller.restore);
router.post("/database/restore", upload.single("backup"), controller.restore);

export default router;
