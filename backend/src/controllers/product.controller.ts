import { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/product.service";
import { imageService } from "../services/image.service";
import { logger } from "../logger/logger";
import fs from "fs";

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
      const id = parseInt(req.params.id as string, 10);
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
      const product = await this.service.create(req.body);
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
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "ID must be a number",
        });
        return;
      }
      const product = await this.service.update(id, req.body);
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
      const id = parseInt(req.params.id as string, 10);
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

  uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "ID must be a number",
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "No image file provided",
        });
        return;
      }

      const product = await this.service.getById(id);
      if (!product) {
        // Remove uploaded file if product not found to prevent leaks
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(404).json({
          success: false,
          message: "Not Found",
          error: `Product with ID ${id} not found`,
        });
        return;
      }

      // If previous image exists, delete it via pluggable storage provider
      if (product.image_url) {
        try {
          await imageService.delete(product.image_url);
        } catch (e) {
          logger.error("Failed to delete previous image", e);
        }
      }

      // Route image stream/upload to active storage provider
      const secureUrl = await imageService.upload(req.file.path);
      logger.info(`[Image Upload] Cloudinary secure_url: ${secureUrl}`);
      const updatedProduct = await this.service.update(id, { image_url: secureUrl });
      logger.info(`[Image Upload] Database image_url updated to: ${updatedProduct.image_url}`);

      const responsePayload = {
        success: true,
        imageUrl: secureUrl,
      };
      logger.info(`[Image Upload] API response payload: ${JSON.stringify(responsePayload)}`);

      res.status(200).json(responsePayload);
    } catch (error) {
      next(error);
    }
  };

  getMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          error: "ID must be a number",
        });
        return;
      }
      const movements = await this.service.getMovements(id);
      res.status(200).json({
        success: true,
        data: movements,
      });
    } catch (error) {
      next(error);
    }
  };
}
