import { Router } from "express";
import { StoreController } from "../controllers/store.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new StoreController();

router.use(authenticate());

router.get("/", controller.getAll);
router.get("/current", controller.getCurrent);
router.post("/switch", controller.switchStore);
router.get("/:id", controller.getById);
router.post("/", authorize("admin"), controller.create);
router.put("/:id", authorize("admin"), controller.update);
router.patch("/:id/disable", authorize("admin"), controller.disable);
router.delete("/:id", authorize("admin"), controller.disable);

export default router;
