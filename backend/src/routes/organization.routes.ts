import { Router } from "express";
import { OrganizationController } from "../controllers/organization.controller";
import { authorize, authenticate } from "../middleware/auth.middleware";

const router = Router();
const controller = new OrganizationController();

// Public invitation acceptance
router.post("/invitations/accept", controller.acceptInvitation);

// Authenticated organization administration endpoints
router.get("/current", authenticate(), controller.getCurrent);
router.put("/current", authenticate(), authorize("Owner", "Admin", "owner", "admin"), controller.updateCurrent);
router.get("/dashboard", authenticate(), authorize("super_admin", "superadmin"), controller.getDashboard);
router.get("/stats", authenticate(), controller.getStats);
router.post("/onboarding/complete", authenticate(), controller.completeOnboarding);
router.post("/onboarding/reset", authenticate(), controller.resetOnboarding);

router.post("/", authenticate(), authorize("Owner", "Admin", "owner", "admin"), controller.create);
router.post("/invitations", authenticate(), authorize("Owner", "Admin", "owner", "admin", "Manager", "manager"), controller.inviteUser);

// API Keys endpoints
router.post("/keys", authenticate(), authorize("Owner", "Admin", "owner", "admin"), controller.createApiKey);
router.get("/keys", authenticate(), authorize("Owner", "Admin", "owner", "admin"), controller.listApiKeys);
router.delete("/keys/:id", authenticate(), authorize("Owner", "Admin", "owner", "admin"), controller.deleteApiKey);

// Support tickets endpoints
router.post("/tickets", authenticate(), controller.createTicket);
router.get("/tickets", authenticate(), controller.listTickets);

export default router;
