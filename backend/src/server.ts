import { env } from "./config/env";
import { app } from "./app";
import { initDb } from "./database/init";
import dbProxy from "./database";
import { logger } from "./logger/logger";
import { downloadFonts } from "./utils/font-downloader";
import { SyncQueueManager } from "./services/sync.service";
import { schedulePdfCleanup } from "./services/pdf-cleanup.service";

process.stdout.write("--> STARTING SERVER.TS EXECUTOR\n");

async function startServer(): Promise<void> {
  process.stdout.write("--> ENTERING startServer FUNCTION\n");
  try {
    // Database initialization prints Loading database... and Connecting PostgreSQL...
    process.stdout.write("--> CALLING initDb()\n");
    await initDb();
    process.stdout.write("--> initDb() COMPLETED\n");

    console.log("Initializing repositories...");
    // Repositories initialization is static in memory

    console.log("Registering routes...");
    // Express routes are mounted statically

    console.log("Starting Express...");
    const PORT = Number(env.PORT) || 8080;
    
    const server = app.listen(PORT, "0.0.0.0", () => {
      process.stdout.write(`--> LISTEN SUCCESSFUL ON PORT ${PORT}\n`);
      console.log(`Listening on PORT ${PORT}...`);
      console.log("Startup completed.");
      logger.info(`✅ Server running on port ${PORT} (env: ${env.NODE_ENV})`);
      
      // Download required Outfit fonts asynchronously
      downloadFonts().catch((err) => logger.error("⚠️ Font download failed", err));

      // Boot singleton background sync manager immediately
      SyncQueueManager.getInstance();

      // Start automatic daily PDF cleanup scheduler
      schedulePdfCleanup();
    });

    // Graceful Process Shutdown Hook
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal} shutdown signal. Closing server handles...`);
      server.close(async () => {
        logger.info("Express http connection listener terminated.");
        try {
          await dbProxy.close();
          logger.info("Database adapter connection pooled handles closed.");
          logger.info("Graceful shutdown cleanup completed successfully.");
          process.exit(0);
        } catch (dbErr) {
          logger.error("Failure encountered during database handle cleanup:", dbErr);
          process.exit(1);
        }
      });

      // Strict termination fallback limit
      setTimeout(() => {
        logger.error("Forced hard termination triggered due to timeout limit.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error: any) {
    console.error("ERROR:");
    console.error(`Stack: ${error instanceof Error ? error.stack : error}`);
    console.error(`Cause: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

process.stdout.write("--> CALLING startServer()\n");
startServer();