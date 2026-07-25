import { Router } from "express";
import { SuperAdminController } from "../controllers/super-admin.controller";
import { authenticate, authorizeSuperAdmin } from "../middleware/auth.middleware";

const router = Router();
const controller = new SuperAdminController();

// Require Super Admin authentication for all routes
router.use(authenticate());
router.use(authorizeSuperAdmin());

router.get("/dashboard", controller.getDashboard);
router.get("/organizations", controller.listOrganizations);
router.post("/organizations", controller.createOrganization);
router.get("/organizations/:id", controller.getOrganizationDetails);
router.put("/organizations/:id", controller.editOrganization);
router.patch("/organizations/:id/status", controller.updateStatus);
router.post("/organizations/:id/reset-password", controller.resetOwnerPassword);

export default router;
