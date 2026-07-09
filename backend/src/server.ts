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

import path from "path";

dotenv.config();

// Connect to SQLite and initialize database tables before starting Express
initDb();

const app = express();

app.use(cors());
app.use(express.json());
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
    message: "🚀 Orion POS Backend Running",
  });
});

// Register Global Error Middleware (MUST be registered after all route handlers)
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});