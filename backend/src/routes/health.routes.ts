import { Router, Request, Response } from "express";
import dbProxy from "../database";

const router = Router();
const startTime = Date.now();

/**
 * Liveness Probe (/health/live or /live)
 * Verifies that the Node.js process is responsive.
 */
router.get("/live", (_req: Request, res: Response): void => {
  res.status(200).json({
    status: "UP",
    liveness: true,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness Probe (/health/ready or /ready)
 * Verifies that database connectivity is active and ready to serve queries.
 */
router.get("/ready", async (_req: Request, res: Response): Promise<void> => {
  try {
    await dbProxy.queryOne("SELECT 1");
    res.status(200).json({
      status: "UP",
      readiness: true,
      database: "UP",
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(503).json({
      status: "UNHEALTHY",
      readiness: false,
      database: "OFFLINE",
      message: "Database connection probe failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Comprehensive Diagnostics Probe (/health)
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  let dbStatus = "UP";
  try {
    await dbProxy.queryOne("SELECT 1");
  } catch (e) {
    dbStatus = "OFFLINE";
  }

  const isHealthy = dbStatus === "UP";
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? "UP" : "DEGRADED",
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
