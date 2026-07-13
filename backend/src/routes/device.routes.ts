import { Router } from "express";
import { DeviceController } from "../controllers/device.controller";

const router = Router();
const controller = new DeviceController();

router.get("/settings", controller.getSettings);
router.put("/settings", controller.updateSettings);

export default router;
