import { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/product.service";
import { CreateProductSchema, UpdateProductSchema } from "../schemas/product.schema";

export class ProductController {
  private service: ProductService;

  constructor() {
    this.service = new ProductService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await this.service.getAll();
      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "ID must be a number",
        });
        return;
      }
      const product = await this.service.getById(id);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate incoming request schema
      const dto = CreateProductSchema.parse(req.body);
      const product = await this.service.create(dto);
      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "ID must be a number",
        });
        return;
      }
      // Validate incoming request schema
      const dto = UpdateProductSchema.parse(req.body);
      const product = await this.service.update(id, dto);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "ID must be a number",
        });
        return;
      }
      await this.service.delete(id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = String(req.query.q || "");
      if (!req.query.q) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "Search query parameter 'q' is required",
        });
        return;
      }
      const products = await this.service.search(query);
      res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  };
}
