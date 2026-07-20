import { Router } from "express";
import { SupplierController } from "../controllers/supplier.controller";
import { validate } from "../middleware/validation.middleware";
import { CreateSupplierSchema, UpdateSupplierSchema } from "../validation/supplier.validation";

const router = Router();
const controller = new SupplierController();

// GET suppliers search (MUST be defined before GET /:id)
router.get("/search", controller.search);

// GET all suppliers (supports q, sort, includeArchived query parameters)
router.get("/", controller.getAll);

// GET supplier by ID
router.get("/:id", controller.getById);

// POST create supplier
router.post("/", validate(CreateSupplierSchema), controller.create);

// PUT update supplier
router.put("/:id", validate(UpdateSupplierSchema), controller.update);

// DELETE supplier (soft delete / archive)
router.delete("/:id", controller.delete);

export default router;
