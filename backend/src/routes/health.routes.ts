import { Router, Request, Response } from "express";
import dbProxy from "../database";

const router = Router();
const startTime = Date.now();

router.get("/", async (req: Request, res: Response): Promise<void> => {
  let dbStatus = "UP";
  try {
    // Probe database using simple query test
    await dbProxy.queryOne("SELECT 1");
  } catch (e) {
    dbStatus = "DOWN";
  }

  const isUp = dbStatus === "UP";
  res.status(isUp ? 200 : 503).json({
    status: isUp ? "UP" : "DEGRADED",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    database: dbStatus,
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
    }
  });
});

export default router;
