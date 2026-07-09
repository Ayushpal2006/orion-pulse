import { Router } from "express";

const router = Router();

let products: any[] = [];

// GET all products
router.get("/", (req, res) => {
  res.json(products);
});

// POST product
router.post("/", (req, res) => {
  const product = {
    id: products.length + 1,
    ...req.body,
  };

  products.push(product);

  res.status(201).json({
    message: "Product created successfully",
    product,
  });
});

export default router;