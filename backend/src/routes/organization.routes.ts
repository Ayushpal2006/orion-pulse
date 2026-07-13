import { Router } from "express";
import { OrganizationController } from "../controllers/organization.controller";
import { authorize, authenticate } from "../middleware/auth.middleware";

const router = Router();
const controller = new OrganizationController();

// Public invitation acceptance
router.post("/invitations/accept", controller.acceptInvitation);

// Authenticated organization endpoints
router.post("/", authenticate(), authorize("admin"), controller.create);
router.post("/invitations", authenticate(), authorize("admin", "manager"), controller.inviteUser);

// API Keys endpoints
router.post("/keys", authenticate(), authorize("admin"), controller.createApiKey);
router.get("/keys", authenticate(), authorize("admin"), controller.listApiKeys);
router.delete("/keys/:id", authenticate(), authorize("admin"), controller.deleteApiKey);

// Support tickets endpoints
router.post("/tickets", authenticate(), controller.createTicket);
router.get("/tickets", authenticate(), controller.listTickets);

export default router;
