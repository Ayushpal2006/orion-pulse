import { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/product.service";
import { imageService } from "../services/image.service";
import { logger } from "../logger/logger";
import fs from "fs";
import { getTenantContext, storeStorage } from "../db/context";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { GoogleSyncDispatcher } from "../services/google-sync-dispatcher.service";

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

      // Non-blocking Google Sync Event Dispatch
      GoogleSyncDispatcher.dispatchSyncEvent("PRODUCT_CREATED", product, getTenantContext());
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

      // Non-blocking Google Sync Event Dispatch
      GoogleSyncDispatcher.dispatchSyncEvent("PRODUCT_UPDATED", product, getTenantContext());
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

      // Non-blocking Google Sync Event Dispatch
      GoogleSyncDispatcher.dispatchSyncEvent("PRODUCT_ARCHIVED", { id, isActive: false }, getTenantContext());
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

  uploadImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

      // Re-bind storeStorage context from req.user in case async multipart upload (Multer) escaped AsyncLocalStorage scope
      const user = req.user;
      const orgId = user?.organization_id || getTenantContext().organizationId;
      const storeId = user?.store_id || getTenantContext().currentStoreId;
      const userId = user?.id || getTenantContext().userId;
      const role = user?.role || getTenantContext().role || "admin";

      await storeStorage.run(
        { organizationId: orgId, currentStoreId: storeId, userId, role },
        async () => {
          const ctx = getTenantContext();
          console.log("[IMAGE UPLOAD DIAGNOSTIC]", {
            requestedProductId: id,
            authenticatedOrganizationId: ctx.organizationId,
            authenticatedStoreId: ctx.currentStoreId,
            userId: ctx.userId,
            headersStoreId: req.headers["x-store-id"],
            headersOrgId: req.headers["x-organization-id"],
          });

          const product = await this.service.getById(id);
          if (!product) {
            if (req.file!.path && fs.existsSync(req.file!.path)) {
              fs.unlinkSync(req.file!.path);
            }
            res.status(404).json({
              success: false,
              message: "Not Found",
              error: `Product with ID ${id} not found`,
            });
            return;
          }

          // Delete previous image if exists
          if (product.image_url) {
            try {
              await imageService.delete(product.image_url);
            } catch (e) {
              logger.error("Failed to delete previous image", e);
            }
          }

          // Upload image to Cloudinary with tenant metadata
          const secureUrl = await imageService.upload(req.file!.path, {
            organizationId: ctx.organizationId,
            storeId: ctx.currentStoreId,
            productId: id,
          });
          logger.info(`[Image Upload] Cloudinary secure_url: ${secureUrl}`);
          const updatedProduct = await this.service.update(id, { image_url: secureUrl });
          logger.info(`[Image Upload] Database image_url updated to: ${updatedProduct?.image_url}`);

          const responsePayload = {
            success: true,
            imageUrl: secureUrl,
            data: updatedProduct,
          };

          res.status(200).json(responsePayload);
        }
      );
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
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
