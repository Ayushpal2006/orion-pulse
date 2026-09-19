import { Router, Request, Response } from "express";
import dbProxy from "../database";

const router = Router();
const startTime = Date.now();

/**
 * Lightweight Liveness & Status Probes (/health and /health/live)
 * Returns immediate OK without blocking on external database calls.
 */
router.get("/", (_req: Request, res: Response): void => {
  res.status(200).json({
    status: "ok",
    service: "orion-pos-api",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

router.get("/live", (_req: Request, res: Response): void => {
  res.status(200).json({
    status: "ok",
    liveness: true,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Dedicated Database Connectivity Probes (/health/db and /health/ready)
 * Actively verifies PostgreSQL / Hyperdrive connection readiness.
 */
router.get("/db", async (_req: Request, res: Response): Promise<void> => {
  try {
    await dbProxy.queryOne("SELECT 1 as connected");
    res.status(200).json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      message: e?.message || "Database probe failed",
      timestamp: new Date().toISOString(),
    });
  }
});

router.get("/ready", async (_req: Request, res: Response): Promise<void> => {
  try {
    await dbProxy.queryOne("SELECT 1 as connected");
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

export default router;
