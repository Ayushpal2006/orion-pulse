import { IBackupProvider } from "../interfaces/IBackupProvider";
import dbProxy, { closeAndReopenDb } from "../database";
import { env } from "../config/env";
import { logger } from "../logger/logger";
import fs from "fs";
import path from "path";

export class SQLiteBackupProvider implements IBackupProvider {
  async backup(destinationPath: string): Promise<void> {
    logger.info(`💾 SQLiteBackupProvider: Backing up database to ${destinationPath}`);
    if (typeof dbProxy.backup === "function") {
      await dbProxy.backup(destinationPath);
    } else {
      throw new Error("Backup operation not supported by active database adapter.");
    }
  }

  async restore(sourcePath: string): Promise<void> {
    logger.info(`🔄 SQLiteBackupProvider: Restoring database from ${sourcePath}`);
    
    // Close sqlite connection prior to swapping files
    closeAndReopenDb();

    const targetPath = path.isAbsolute(env.DATABASE_URL)
      ? env.DATABASE_URL
      : path.join(process.cwd(), env.DATABASE_URL);

    // Overwrite database file
    fs.copyFileSync(sourcePath, targetPath);

    // Clean up temporary restore upload file
    try {
      fs.unlinkSync(sourcePath);
    } catch (e) {
      logger.error("Failed to delete temp restore file", e);
    }

    // Reopen connection
    closeAndReopenDb();
    logger.info("✅ SQLiteBackupProvider: Restore completed.");
  }
}
