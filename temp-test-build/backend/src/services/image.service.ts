import { IImageStorage } from "../interfaces/IImageStorage";
import { CloudinaryStorage } from "../storage/cloudinary.storage";
import { LocalStorage } from "../storage/local.storage";
import { cloudinaryConfig } from "../config/cloudinary";
import { logger } from "../logger/logger";

export class ImageService implements IImageStorage {
  private activeStorage: IImageStorage;

  constructor() {
    if (cloudinaryConfig.isConfigured) {
      logger.info("📸 Pluggable Image storage initialized: Cloudinary");
      this.activeStorage = new CloudinaryStorage();
    } else {
      logger.warn("📸 Cloudinary is not configured. Falling back to Local Disk Storage");
      this.activeStorage = new LocalStorage();
    }
  }

  async upload(filePath: string): Promise<string> {
    return this.activeStorage.upload(filePath);
  }

  async delete(url: string): Promise<void> {
    if (!url) return;
    return this.activeStorage.delete(url);
  }
}

export const imageService = new ImageService();
