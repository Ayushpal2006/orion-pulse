import { IBackupProvider } from "../interfaces/IBackupProvider";
import { databaseConfig } from "../config/database";
import { logger } from "../logger/logger";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export class PostgresBackupProvider implements IBackupProvider {
  async backup(destinationPath: string): Promise<void> {
    logger.info(`💾 PostgresBackupProvider: Backing up database to ${destinationPath}`);
    const connectionString = databaseConfig.postgres.connectionString;
    
    if (!connectionString) {
      throw new Error("PostgreSQL connection string is not configured.");
    }

    try {
      // Execute pg_dump command to extract DB backup to plain text SQL format
      const cmd = `pg_dump "${connectionString}" -F p -b -v --clean --no-owner --no-privileges -f "${destinationPath}"`;
      logger.info(`Running PostgreSQL pg_dump command`);
      await execPromise(cmd);
      logger.info("✅ PostgresBackupProvider: Plain SQL backup completed successfully.");
    } catch (e: any) {
      logger.error("❌ PostgresBackupProvider: pg_dump backup failed:", e);
      throw new Error(`PostgreSQL backup failed: ${e.message}`);
    }
  }

  async restore(sourcePath: string): Promise<void> {
    logger.info(`🔄 PostgresBackupProvider: Restoring database from ${sourcePath}`);
    const connectionString = databaseConfig.postgres.connectionString;

    if (!connectionString) {
      throw new Error("PostgreSQL connection string is not configured.");
    }

    try {
      // Execute psql tool to run plain text SQL backup commands
      const cmd = `psql "${connectionString}" -f "${sourcePath}"`;
      logger.info(`Running PostgreSQL psql restore command`);
      await execPromise(cmd);
      logger.info("✅ PostgresBackupProvider: Restore completed successfully.");
    } catch (e: any) {
      logger.error("❌ PostgresBackupProvider: psql restore failed:", e);
      throw new Error(`PostgreSQL restore failed: ${e.message}`);
    }
  }
}
