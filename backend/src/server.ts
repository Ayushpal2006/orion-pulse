import { env } from "./config/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

import productRoutes from "./routes/product.routes";
import customerRoutes from "./routes/customer.routes";
import checkoutRoutes from "./routes/checkout.routes";
import salesRoutes from "./routes/sales.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import reportsRoutes from "./routes/reports.routes";
import printerRoutes from "./routes/printer.routes";
import settingsRoutes from "./routes/settings.routes";
import invoiceRoutes from "./routes/invoice.routes";
import syncRoutes from "./routes/sync.routes";
import healthRoutes from "./routes/health.routes";
import adminRoutes from "./routes/admin.routes";

// New Phase 3-7 modules
import authRoutes from "./routes/auth.routes";
import supplierRoutes from "./routes/supplier.routes";
import supplierPaymentRoutes from "./routes/supplier-payment.routes";
import profitRoutes from "./routes/profit.routes";
import purchaseRoutes from "./routes/purchase.routes";
import inventoryRoutes from "./routes/inventory.routes";
import expenseRoutes from "./routes/expense.routes";
import analyticsRoutes from "./routes/analytics.routes";
import stockAdjustmentRoutes from "./routes/stock-adjustment.routes";
import exportRoutes from "./routes/export.routes";
import backupRoutes from "./routes/backup.routes";
import deviceRoutes from "./routes/device.routes";
import auditRoutes from "./routes/audit.routes";
import orgRoutes from "./routes/organization.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import copilotRoutes from "./routes/copilot.routes";
import databaseRoutes from "./routes/database.routes";
import { authenticate, authorize } from "./middleware/auth.middleware";

import { initDb } from "./database/init";
import dbProxy from "./database";
import { errorMiddleware } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { rateLimiter } from "./middleware/rateLimit.middleware";
import { logger } from "./logger/logger";
import { downloadFonts } from "./utils/font-downloader";
import { SyncQueueManager } from "./services/sync.service";
import { schedulePdfCleanup } from "./services/pdf-cleanup.service";

import path from "path";
import fs from "fs";

// Trap process exceptions immediately
process.on("unhandledRejection", (reason: any) => {
  logger.error("💥 Unhandled Promise Rejection", reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  logger.error("💥 Uncaught Exception", error);
  process.exit(1);
});

const app = express();

// Security and performance middleware configurations
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);

// Enable Helmet (disable cross-origin resource policy so local upload assets can be loaded in web context)
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

app.use(compression());

// CORS configuration (no wildcards in production)
const allowedOrigins = env.ALLOWED_ORIGINS.split(",");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || env.NODE_ENV === "development") {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Request body payload limits
app.use(express.json({ limit: "10mb" }));

// Request logging middleware
app.use(requestLogger);

// Global Rate Limiting middleware
app.use(rateLimiter);

// Intercept requests for deleted PDFs to dynamically regenerate them from receipt logs
app.get("/uploads/invoices/:pdfName", async (req, res, next) => {
  const { pdfName } = req.params;
  if (pdfName && pdfName.endsWith(".pdf")) {
    const pdfPath = path.join(__dirname, "../uploads/invoices", pdfName);
    if (!fs.existsSync(pdfPath)) {
      logger.warn(`⚠️ PDF invoice not found on disk: ${pdfName}. Attempting dynamic regeneration...`);
      const invoiceNumber = pdfName.slice(0, -4);
      try {
        const { SalesService } = require("./services/sales.service");
        const { PdfService } = require("./services/pdf.service");
        const salesService = new SalesService();
        const receipt = await salesService.getReceipt(invoiceNumber);
        if (receipt) {
          const pdfService = new PdfService();
          await pdfService.generateInvoicePdf(receipt, pdfPath);
          logger.info(`✨ Dynamic regeneration complete for: ${pdfName}`);
        }
      } catch (err) {
        logger.error(`❌ Dynamic regeneration failed for: ${pdfName}`, err);
      }
    }
  }
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/storage", express.static(path.join(__dirname, "../storage")));

// Mount Health Check endpoint (Railway deployment integration)
app.use("/health", healthRoutes);

// Auth endpoints (Public login/logout)
app.use("/api/auth", authRoutes);

// App routes configuration (All authenticated)
app.use("/products", authenticate(), productRoutes);
app.use("/customers", authenticate(), customerRoutes);
app.use("/checkout", authenticate(), checkoutRoutes);
app.use("/sales", authenticate(), salesRoutes);
app.use("/invoices", authenticate(), salesRoutes);
app.use("/dashboard", authenticate(), dashboardRoutes);
app.use("/reports", authenticate(), authorize("admin", "manager"), reportsRoutes);
app.use("/printer", authenticate(), printerRoutes);
app.use("/settings", authenticate(), settingsRoutes);
app.use("/settings/database", authenticate(), databaseRoutes);
app.use("/invoice", invoiceRoutes); // Public HTML invoice access
app.use("/sync", authenticate(), syncRoutes);
app.use("/api/admin", authenticate(), authorize("admin"), adminRoutes);

// New Modules
app.use("/api/suppliers", authenticate(), supplierRoutes);
app.use("/api/supplier-payments", authenticate(), supplierPaymentRoutes);
app.use("/api/profit", authenticate(), profitRoutes);
app.use("/api/purchases", authenticate(), purchaseRoutes);
app.use("/api/inventory", authenticate(), inventoryRoutes);
app.use("/api/expenses", authenticate(), expenseRoutes);
app.use("/api/analytics", authenticate(), authorize("admin", "manager"), analyticsRoutes);
app.use("/api/stock-adjustments", authenticate(), stockAdjustmentRoutes);
app.use("/api/export", authenticate(), exportRoutes);
app.use("/api/backup", authenticate(), backupRoutes);
app.use("/api/device", authenticate(), deviceRoutes);
app.use("/api/audit", authenticate(), auditRoutes);
app.use("/api/organizations", orgRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/ai/copilot", copilotRoutes);

// Root Check Endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "orion-pos-backend",
    timestamp: new Date().toISOString(),
  });
});

// Register Global Error Middleware (MUST be registered after all route handlers)
app.use(errorMiddleware);

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