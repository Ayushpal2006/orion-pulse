import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { SettingsController } from "../controllers/settings.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new SettingsController();

const upload = multer({ storage: multer.memoryStorage() });

// Every signed-in role (cashiers included) reads settings to render receipts and UPI QR codes.
// Changing them (store identity, UPI VPA, ...) or backing up / restoring data is limited to the
// same roles /api/backup allows; otherwise a cashier could redirect UPI payments or overwrite data.
const canManageStore = authorize("admin", "manager", "superadmin");

router.get("/", controller.getAll);
router.post("/", canManageStore, controller.update);
router.put("/", canManageStore, controller.update);
router.patch("/", canManageStore, controller.update);
router.get("/storage", controller.getStorageStatus);
router.post("/storage/cleanup", canManageStore, controller.triggerCleanup);
router.get("/backup", canManageStore, controller.backup);
router.get("/database/backup", canManageStore, controller.backup);
router.post("/restore", canManageStore, upload.single("backup"), controller.restore);
router.post("/database/restore", canManageStore, upload.single("backup"), controller.restore);

export default router;
