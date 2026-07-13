import { Router } from "express";
import { CopilotController } from "../controllers/copilot.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const controller = new CopilotController();

router.post("/query", authenticate(), controller.query);

export default router;
