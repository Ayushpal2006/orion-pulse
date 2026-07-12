import fs from "fs";
import path from "path";
import { IImageStorage } from "../interfaces/IImageStorage";

export class LocalStorage implements IImageStorage {
  private targetDir = path.join(__dirname, "../../uploads/products");

  constructor() {
    if (!fs.existsSync(this.targetDir)) {
      fs.mkdirSync(this.targetDir, { recursive: true });
    }
  }

  async upload(filePath: string): Promise<string> {
    const filename = path.basename(filePath);
    const destinationPath = path.join(this.targetDir, filename);

    // Copy file from temp location to uploads directory
    fs.copyFileSync(filePath, destinationPath);

    // Delete temporary multer uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      // Ignored
    }

    return `/uploads/products/${filename}`;
  }

  async delete(url: string): Promise<void> {
    // Only handle local uploads
    if (!url.startsWith("/uploads/products/")) {
      return;
    }

    const filename = url.replace("/uploads/products/", "");
    const filePath = path.join(this.targetDir, filename);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Failed to delete local product image:", e);
      }
    }
  }
}
