import { Router } from "express";
import { ProductController } from "../controllers/product.controller";
import { upload } from "../middleware/upload.middleware";
import { validate } from "../middleware/validation.middleware";
import { CreateProductSchema, UpdateProductSchema } from "../schemas/product.schema";

const router = Router();
const controller = new ProductController();

// GET products search (MUST be defined before GET /:id)
router.get("/search", controller.search);

// GET all products
router.get("/", controller.getAll);

// GET product by ID
router.get("/:id", controller.getById);

// POST create product
router.post("/", validate(CreateProductSchema), controller.create);

// PUT update product
router.put("/:id", validate(UpdateProductSchema), controller.update);

// POST upload product image
router.post("/:id/image", upload.single("image"), controller.uploadImage);

// DELETE product
router.delete("/:id", controller.delete);

export default router;