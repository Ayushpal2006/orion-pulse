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
import googleRoutes from "./routes/google.routes";
import healthRoutes from "./routes/health.routes";
import adminRoutes from "./routes/admin.routes";
import kotRoutes from "./routes/kot.routes";

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
import storeRoutes from "./routes/store.routes";
import userRoutes from "./routes/user.routes";
import exportRoutes from "./routes/export.routes";
import backupRoutes from "./routes/backup.routes";
import deviceRoutes from "./routes/device.routes";
import auditRoutes from "./routes/audit.routes";
import orgRoutes from "./routes/organization.routes";
import superAdminRoutes from "./routes/super-admin.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import copilotRoutes from "./routes/copilot.routes";
import databaseRoutes from "./routes/database.routes";
import { authenticate, authorize } from "./middleware/auth.middleware";

import { errorMiddleware } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { authLimiter, apiLimiter } from "./middleware/rateLimit.middleware";
import { logger } from "./logger/logger";

export const app = express();

// Security and performance middleware configurations
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);

// Enable Helmet (disable cross-origin resource policy so local upload assets can be loaded in web context)
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

app.use((req, res, next) => {
  // Cloudflare Workers handles Gzip/Brotli at the edge network; skip Node stream compression in serverless
  if (process.env.CF_PAGES || process.env.CF_WORKER || !res.socket || !(res.socket as any).write) {
    return next();
  }
  return compression()(req, res, next);
});

// CORS configuration (deploy-safe, handles preflight OPTIONS & mobile origins)
const parseAllowedOrigins = (originsStr?: string): string[] => {
  if (!originsStr) return ["*"];
  return originsStr.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile native apps, curl, server-to-server) where origin is undefined
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.trim().replace(/\/+$/, "");
    const allowed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS);

    if (
      env.NODE_ENV === "development" ||
      allowed.includes(cleanOrigin) ||
      allowed.includes("*") ||
      allowed.some((a) => a.startsWith("*.") && cleanOrigin.endsWith(a.slice(1)))
    ) {
      return callback(null, true);
    }

    // Pass false to omit CORS headers without throwing an Express error that breaks preflight OPTIONS
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Store-Id",
    "X-Organization-Id",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],
}));

// Request body payload limits
app.use(express.json({ limit: "10mb" }));

// Request logging middleware
app.use(requestLogger);

// Rate Limiting middleware
app.use(apiLimiter);

// Mount Health Check endpoint
app.use("/health", healthRoutes);
app.use("/api/health", healthRoutes);

// Auth endpoints (Brute-force protected)
app.use("/api/auth", authLimiter, authRoutes);
app.use("/auth", authLimiter, authRoutes);

// App routes configuration (All authenticated)
app.use("/products", authenticate(), productRoutes);
app.use("/api/products", authenticate(), productRoutes);
app.use("/customers", authenticate(), customerRoutes);
app.use("/api/customers", authenticate(), customerRoutes);
app.use("/checkout", authenticate(), checkoutRoutes);
app.use("/api/checkout", authenticate(), checkoutRoutes);
app.use("/sales", authenticate(), salesRoutes);
app.use("/api/sales", authenticate(), salesRoutes);
app.use("/invoices", authenticate(), salesRoutes);
app.use("/api/invoices", authenticate(), salesRoutes);
app.use("/dashboard", authenticate(), dashboardRoutes);
app.use("/api/dashboard", authenticate(), dashboardRoutes);
app.use("/reports", authenticate(), authorize("admin", "manager"), reportsRoutes);
app.use("/api/reports", authenticate(), authorize("admin", "manager"), reportsRoutes);
app.use("/printer", authenticate(), printerRoutes);
app.use("/settings", authenticate(), settingsRoutes);
app.use("/api/settings", authenticate(), settingsRoutes);
app.use("/settings/database", authenticate(), databaseRoutes);
app.use("/api/settings/database", authenticate(), databaseRoutes);
app.use("/invoice", apiLimiter, invoiceRoutes); // Public HTML/PDF invoice access
app.use("/r", apiLimiter, invoiceRoutes); // Short Public Receipt link /r/:token
app.use("/sync", authenticate(), syncRoutes);
app.use("/api/sync", authenticate(), syncRoutes);
app.use("/google", googleRoutes);
app.use("/api/google", googleRoutes);
app.use("/api/admin", authenticate(), authorize("admin"), adminRoutes);
app.use("/kot", authenticate(), kotRoutes);
app.use("/api/kot", authenticate(), kotRoutes);

// New Modules
app.use("/api/users", authenticate(), userRoutes);
app.use("/users", authenticate(), userRoutes);
app.use("/api/stores", authenticate(), storeRoutes);
app.use("/stores", authenticate(), storeRoutes);
app.use("/api/suppliers", authenticate(), supplierRoutes);
app.use("/api/supplier-payments", authenticate(), supplierPaymentRoutes);
app.use("/api/profit", authenticate(), profitRoutes);
app.use("/purchases", authenticate(), purchaseRoutes);
app.use("/purchase-orders", authenticate(), purchaseRoutes);
app.use("/api/purchases", authenticate(), purchaseRoutes);
app.use("/api/purchase-orders", authenticate(), purchaseRoutes);
app.use("/api/inventory", authenticate(), inventoryRoutes);
app.use("/inventory", authenticate(), inventoryRoutes);
app.use("/api/expenses", authenticate(), expenseRoutes);
app.use("/expenses", authenticate(), expenseRoutes);
app.use("/api/analytics", authenticate(), authorize("admin", "manager"), analyticsRoutes);
app.use("/analytics", authenticate(), authorize("admin", "manager"), analyticsRoutes);
app.use("/api/stock-adjustments", authenticate(), stockAdjustmentRoutes);
app.use("/stock-adjustments", authenticate(), stockAdjustmentRoutes);
app.use("/api/export", authenticate(), exportRoutes);
app.use("/export", authenticate(), exportRoutes);
app.use("/api/backup", authenticate(), backupRoutes);
app.use("/backup", authenticate(), backupRoutes);
app.use("/api/device", authenticate(), deviceRoutes);
app.use("/device", authenticate(), deviceRoutes);
app.use("/api/audit", authenticate(), auditRoutes);
app.use("/audit", authenticate(), auditRoutes);
app.use("/api/organizations", orgRoutes);
app.use("/api/super-admin", superAdminRoutes);
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
