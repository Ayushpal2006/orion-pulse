import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import productRoutes from "./routes/product.routes";
import { initDb } from "./database/init";
import { errorMiddleware } from "./middleware/error.middleware";

dotenv.config();

// Connect to SQLite and initialize database tables before starting Express
initDb();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/products", productRoutes);

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