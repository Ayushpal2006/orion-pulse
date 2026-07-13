import dbProxy from "../database";
import { databaseConfig } from "../config/database";
import { cloudinaryConfig } from "../config/cloudinary";
import { logger } from "../logger/logger";
import fs from "fs";
import path from "path";

export interface ResetSummary {
  productsDeleted: number;
  customersDeleted: number;
  salesDeleted: number;
  invoicesDeleted: number;
}

export class AdminService {
  async resetDemoData(): Promise<ResetSummary> {
    logger.info("⚡ Initiating database factory reset for demo/transactional data...");

    // Perform database operations inside a transaction
    const result = await dbProxy.transaction(async (tx) => {
      // 1. Query counts of transactional records before deletion
      const productsCountRow = await tx.queryOne<{ count: string | number }>(
        "SELECT COUNT(*) as count FROM products"
      );
      const customersCountRow = await tx.queryOne<{ count: string | number }>(
        "SELECT COUNT(*) as count FROM customers"
      );
      const salesCountRow = await tx.queryOne<{ count: string | number }>(
        "SELECT COUNT(*) as count FROM sales"
      );

      const productsDeleted = Number(productsCountRow?.count || 0);
      const customersDeleted = Number(customersCountRow?.count || 0);
      const salesDeleted = Number(salesCountRow?.count || 0);
      const invoicesDeleted = salesDeleted; // In Orion, sales are invoices

      // 2. Query product image URLs to clean up local storage files afterwards
      const products = await tx.query<{ image_url: string | null }>(
        "SELECT image_url FROM products WHERE image_url IS NOT NULL"
      );
      const imageUrles = products
        .map((p) => p.image_url)
        .filter((url): url is string => !!url);

      // 3. Execute deletes respecting foreign key constraints
      if (databaseConfig.type === "postgres") {
        logger.info("🐘 PostgreSQL detected: truncating tables and restarting identity sequences...");
        // In Postgres, TRUNCATE with RESTART IDENTITY CASCADE resets serial ID sequences safely
        await tx.execute(
          "TRUNCATE TABLE sale_items, sales, products, customers, sync_jobs RESTART IDENTITY CASCADE;"
        );
      } else {
        logger.info("🔌 SQLite detected: deleting from tables in dependency order...");
        // SQLite: Delete in correct order to prevent foreign key violation
        await tx.execute("DELETE FROM sale_items;");
        await tx.execute("DELETE FROM sales;");
        await tx.execute("DELETE FROM products;");
        await tx.execute("DELETE FROM customers;");
        await tx.execute("DELETE FROM sync_jobs;");

        // Reset autoincrement sequences in SQLite
        try {
          await tx.execute(
            "DELETE FROM sqlite_sequence WHERE name IN ('products', 'customers', 'sales', 'sale_items', 'sync_jobs');"
          );
          logger.info("🔄 SQLite AUTOINCREMENT sequences reset.");
        } catch (e) {
          logger.warn("⚠️ sqlite_sequence warning (safely ignored): " + String(e));
        }
      }

      return {
        summary: {
          productsDeleted,
          customersDeleted,
          salesDeleted,
          invoicesDeleted,
        },
        imageUrles,
      };
    });

    // Clean up local product uploads (identifying local files by their path prefix, leaving Cloudinary assets untouched)
    logger.info("📸 Clearing local product image files if present...");
    const uploadsProductsDir = path.resolve(__dirname, "../../uploads/products");
    
    for (const url of result.imageUrles) {
      if (url.startsWith("/uploads/products/")) {
        // Extract only the file name to prevent any path traversal risks
        const filename = path.basename(url);
        const filePath = path.join(uploadsProductsDir, filename);
        
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            logger.info(`🗑️ Deleted local product image file: ${filename}`);
          } catch (e) {
            logger.error(`❌ Failed to delete local image file ${filePath}:`, e);
          }
        }
      }
    }

    // Clean up local invoice PDF files from disk
    logger.info("📑 Purging local generated PDF invoice files...");
    const invoicesDir = path.resolve(__dirname, "../../uploads/invoices");
    if (fs.existsSync(invoicesDir)) {
      try {
        const files = fs.readdirSync(invoicesDir);
        let pdfPurgedCount = 0;
        for (const file of files) {
          if (file.endsWith(".pdf")) {
            try {
              fs.unlinkSync(path.join(invoicesDir, file));
              pdfPurgedCount++;
            } catch (e) {
              logger.error(`❌ Failed to delete invoice PDF ${file}:`, e);
            }
          }
        }
        logger.info(`🗑️ Purged ${pdfPurgedCount} local invoice PDF files.`);
      } catch (err) {
        logger.error("❌ Failed to clear invoice PDFs directory:", err);
      }
    }

    logger.info("✅ Factory Reset operation completed successfully.");
    return result.summary;
  }
}
