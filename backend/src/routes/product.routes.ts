import { Router } from "express";
import { ProductController } from "../controllers/product.controller";
import { upload } from "../middleware/upload.middleware";

const router = Router();
const controller = new ProductController();

// GET products search (MUST be defined before GET /:id)
router.get("/search", controller.search);

// GET all products
router.get("/", controller.getAll);

// GET product by ID
router.get("/:id", controller.getById);

// POST create product
router.post("/", controller.create);

// PUT update product
router.put("/:id", controller.update);

// POST upload product image
router.post("/:id/image", upload.single("image"), controller.uploadImage);

// DELETE product
router.delete("/:id", controller.delete);

export default router;