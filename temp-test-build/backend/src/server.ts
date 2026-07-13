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

import { env } from "./config/env";
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

// Mount Health Check endpoint (Railway deployment integration)
app.use("/health", healthRoutes);

// App routes configuration
app.use("/products", productRoutes);
app.use("/customers", customerRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/sales", salesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/reports", reportsRoutes);
app.use("/printer", printerRoutes);
app.use("/settings", settingsRoutes);
app.use("/invoice", invoiceRoutes);
app.use("/sync", syncRoutes);

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

async function startServer(): Promise<void> {
  try {
    await initDb();
    
    const server = app.listen(env.PORT, () => {
      logger.info(`✅ Server running on port ${env.PORT} (env: ${env.NODE_ENV})`);
      
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

  } catch (error) {
    logger.error("💥 Critical startup failure encountered", error);
    process.exit(1);
  }
}

startServer();