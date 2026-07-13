import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { device_settings } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError } from "../utils/errors";

export class DeviceController {
  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      const deviceId = req.query.deviceId as string;
      if (!deviceId || storeId === undefined) {
        throw new ValidationError("deviceId query parameter is required");
      }

      const [row] = await db
        .select()
        .from(device_settings)
        .where(and(eq(device_settings.device_id, deviceId), eq(device_settings.store_id, storeId)))
        .limit(1);

      res.status(200).json({
        success: true,
        data: row ? {
          id: row.id,
          deviceId: row.device_id,
          printerProfile: row.printer_profile ? JSON.parse(row.printer_profile) : null,
          scannerProfile: row.scanner_profile ? JSON.parse(row.scanner_profile) : null,
        } : null,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const { deviceId, printerProfile, scannerProfile } = req.body;
      if (!deviceId) {
        throw new ValidationError("deviceId is required");
      }

      const printerProfileStr = printerProfile ? JSON.stringify(printerProfile) : null;
      const scannerProfileStr = scannerProfile ? JSON.stringify(scannerProfile) : null;

      // Upsert
      const [existing] = await db
        .select()
        .from(device_settings)
        .where(and(eq(device_settings.device_id, deviceId), eq(device_settings.store_id, storeId)))
        .limit(1);

      let result;
      if (existing) {
        const [updated] = await db
          .update(device_settings)
          .set({
            printer_profile: printerProfileStr ?? existing.printer_profile,
            scanner_profile: scannerProfileStr ?? existing.scanner_profile,
            updated_at: new Date(),
          })
          .where(eq(device_settings.id, existing.id))
          .returning();
        result = updated;
      } else {
        const [inserted] = await db
          .insert(device_settings)
          .values({
            store_id: storeId,
            device_id: deviceId,
            printer_profile: printerProfileStr,
            scanner_profile: scannerProfileStr,
          })
          .returning();
        result = inserted;
      }

      res.status(200).json({
        success: true,
        data: {
          id: result.id,
          deviceId: result.device_id,
          printerProfile: result.printer_profile ? JSON.parse(result.printer_profile) : null,
          scannerProfile: result.scanner_profile ? JSON.parse(result.scanner_profile) : null,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
