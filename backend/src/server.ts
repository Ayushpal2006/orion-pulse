import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
import { initDb } from "./database/init";
import { errorMiddleware } from "./middleware/error.middleware";
import { downloadFonts } from "./utils/font-downloader";
import { SyncQueueManager } from "./services/sync.service";
import { schedulePdfCleanup } from "./services/pdf-cleanup.service";

import path from "path";
import fs from "fs";

dotenv.config();

// Connect to SQLite and initialize database tables before starting Express
initDb();

// Download required Outfit fonts asynchronously
downloadFonts().catch((err) => console.error("⚠️ Font download failed:", err));

// Boot singleton background sync manager immediately
SyncQueueManager.getInstance();

// Start automatic daily PDF cleanup scheduler
schedulePdfCleanup();

const app = express();

app.use(cors());
app.use(express.json());

// Intercept requests for deleted PDFs to dynamically regenerate them from receipt logs
app.get("/uploads/invoices/:pdfName", async (req, res, next) => {
  const { pdfName } = req.params;
  if (pdfName && pdfName.endsWith(".pdf")) {
    const pdfPath = path.join(__dirname, "../uploads/invoices", pdfName);
    if (!fs.existsSync(pdfPath)) {
      console.log(`⚠️ PDF invoice not found on disk: ${pdfName}. Attempting dynamic regeneration...`);
      const invoiceNumber = pdfName.slice(0, -4); // Strip .pdf suffix
      try {
        const { SalesService } = require("./services/sales.service");
        const { PdfService } = require("./services/pdf.service");
        const salesService = new SalesService();
        const receipt = await salesService.getReceipt(invoiceNumber);
        if (receipt) {
          const pdfService = new PdfService();
          await pdfService.generateInvoicePdf(receipt, pdfPath);
          console.log(`✨ Dynamic regeneration complete for: ${pdfName}`);
        }
      } catch (err) {
        console.error(`❌ Dynamic regeneration failed for: ${pdfName}:`, err);
      }
    }
  }
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
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

// Root Health Check Route
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "orion-pos-backend",
    timestamp: new Date().toISOString(),
  });
});

// Register Global Error Middleware (MUST be registered after all route handlers)
app.use(errorMiddleware);

const PORT = Number(process.env.PORT || 8080);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});