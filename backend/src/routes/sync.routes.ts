import { Router, Request, Response } from "express";
import { SyncQueueManager } from "../services/sync.service";

const router = Router();

// GET sync status
router.get("/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const manager = SyncQueueManager.getInstance();
    const status = await manager.getSyncStatus();
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST test connection to specific sheet ID
router.post("/test", async (req: Request, res: Response): Promise<void> => {
  try {
    const { sheetId } = req.body;
    if (!sheetId) {
      res.status(400).json({ success: false, error: "sheetId is required" });
      return;
    }
    const manager = SyncQueueManager.getInstance();
    const connected = await manager.testConnection(sheetId);
    res.status(200).json({
      success: true,
      connected
    });
  } catch (error: any) {
    res.status(200).json({
      success: false,
      connected: false,
      error: error.message
    });
  }
});

// POST trigger manual queue processing
router.post("/trigger", async (req: Request, res: Response): Promise<void> => {
  try {
    const manager = SyncQueueManager.getInstance();
    await manager.processQueue();
    res.status(200).json({
      success: true,
      message: "Sync queue processing triggered"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST retry all failed sync items
router.post("/retry", async (req: Request, res: Response): Promise<void> => {
  try {
    const manager = SyncQueueManager.getInstance();
    await manager.retryFailed();
    res.status(200).json({
      success: true,
      message: "Retrying failed sync jobs"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
