import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const controller = new AuthController();

router.post("/login", controller.login);
router.post("/logout", controller.logout);
router.get("/me", authenticate(), controller.me);

export default router;
