import { Request, Response, NextFunction } from "express";
import { kotService } from "../services/kot.service";

export class KotController {
  private service = kotService;

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, limit, offset } = req.query;

      const kots = await this.service.getAll({
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.status(200).json({
        success: true,
        data: kots,
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
          error: "Valid KOT ID parameter is required",
        });
        return;
      }

      const kot = await this.service.getById(id);
      res.status(200).json({
        success: true,
        data: kot,
      });
    } catch (error) {
      next(error);
    }
  };

  getBySaleId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const saleId = parseInt(req.params.saleId as string, 10);
      if (isNaN(saleId)) {
        res.status(400).json({
          success: false,
          error: "Valid Sale ID parameter is required",
        });
        return;
      }

      const kots = await this.service.getBySaleId(saleId);
      res.status(200).json({
        success: true,
        data: kots,
      });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { status } = req.body;

      if (isNaN(id) || !status) {
        res.status(400).json({
          success: false,
          error: "KOT ID and status are required",
        });
        return;
      }

      const updated = await this.service.updateStatus(id, status);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  reprint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: "Valid KOT ID parameter is required",
        });
        return;
      }

      const updated = await this.service.recordReprint(id);
      res.status(200).json({
        success: true,
        message: `KOT #${updated.kotNumber} reprint logged successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const kotController = new KotController();
