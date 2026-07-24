import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new UserController();

router.use(authenticate());

router.get("/", authorize("Owner", "Admin", "admin", "owner", "Manager", "manager"), controller.getAll);
router.get("/:id", authorize("Owner", "Admin", "admin", "owner", "Manager", "manager"), controller.getById);
router.post("/", authorize("Owner", "Admin", "admin", "owner", "Manager", "manager"), controller.create);
router.put("/:id", authorize("Owner", "Admin", "admin", "owner", "Manager", "manager"), controller.update);
router.patch("/:id/disable", authorize("Owner", "Admin", "admin", "owner", "Manager", "manager"), controller.disable);
router.delete("/:id", authorize("Owner", "Admin", "admin", "owner", "Manager", "manager"), controller.disable);
router.post("/:id/stores", authorize("Owner", "Admin", "admin", "owner", "Manager", "manager"), controller.assignStores);

export default router;
