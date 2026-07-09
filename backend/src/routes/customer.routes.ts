import { Router } from "express";
import { CustomerController } from "../controllers/customer.controller";

const router = Router();
const controller = new CustomerController();

// GET customers search (MUST be defined before GET /:id)
router.get("/search", controller.search);

// GET customer by phone number (MUST be defined before GET /:id)
router.get("/phone/:phone", controller.getByPhone);

// GET all customers
router.get("/", controller.getAll);

// GET customer by ID
router.get("/:id", controller.getById);

// GET customer invoices
router.get("/:id/invoices", controller.getInvoices);

// POST create customer
router.post("/", controller.create);

// PUT update customer
router.put("/:id", controller.update);

// DELETE customer
router.delete("/:id", controller.delete);

export default router;
