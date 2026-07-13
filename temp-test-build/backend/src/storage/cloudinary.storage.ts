import { v2 as cloudinary } from "cloudinary";
import { IImageStorage } from "../interfaces/IImageStorage";
import { cloudinaryConfig } from "../config/cloudinary";
import { logger } from "../logger/logger";
import fs from "fs";

export class CloudinaryStorage implements IImageStorage {
  constructor() {
    if (!cloudinaryConfig.url) {
      cloudinary.config({
        cloud_name: cloudinaryConfig.cloudName,
        api_key: cloudinaryConfig.apiKey,
        api_secret: cloudinaryConfig.apiSecret,
      });
    }
  }

  async upload(filePath: string): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: "orion_products",
        use_filename: true,
        unique_filename: true,
      });

      // Cleanup local temp multer upload file
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        // Ignored
      }

      return result.secure_url;
    } catch (error) {
      logger.error("Cloudinary upload failed", error);
      throw error;
    }
  }

  async delete(url: string): Promise<void> {
    try {
      const publicId = this.extractPublicId(url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        logger.info(`Deleted Cloudinary asset with public ID: ${publicId}`);
      }
    } catch (error) {
      logger.error("Cloudinary delete failed", error);
    }
  }

  private extractPublicId(url: string): string | null {
    // Match URL structure: .../image/upload/(vXXXXXXXX/)?(folder/public_id)(.ext)
    const match = url.match(/\/image\/upload\/(?:v\d+\/)?([^.]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
