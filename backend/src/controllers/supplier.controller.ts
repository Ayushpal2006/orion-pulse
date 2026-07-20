import { Request, Response, NextFunction } from "express";
import { SupplierService } from "../services/supplier.service";

export class SupplierController {
  private service: SupplierService;

  constructor() {
    this.service = new SupplierService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = req.query.q ? String(req.query.q) : undefined;
      const sort = req.query.sort ? String(req.query.sort) : undefined;
      const includeArchived = req.query.includeArchived === "true";

      const suppliers = await this.service.getAll(q, sort, includeArchived);
      res.status(200).json({
        success: true,
        data: suppliers,
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
      const supplier = await this.service.getById(id);
      res.status(200).json({
        success: true,
        data: supplier,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const supplier = await this.service.create(req.body);
      res.status(201).json({
        success: true,
        data: supplier,
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
      const supplier = await this.service.update(id, req.body);
      res.status(200).json({
        success: true,
        data: supplier,
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
      const suppliers = await this.service.search(query);
      res.status(200).json({
        success: true,
        data: suppliers,
      });
    } catch (error) {
      next(error);
    }
  };
}
