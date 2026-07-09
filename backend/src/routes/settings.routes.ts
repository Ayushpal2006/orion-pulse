import { Router, Request, Response } from "express";
import db from "../database/db";

const router = Router();

router.get("/", (req: Request, res: Response): void => {
  try {
    const stmt = db.prepare("SELECT * FROM settings");
    const rows = stmt.all() as { key: string; value: string }[];
    const settingsObj: Record<string, string> = {};
    for (const row of rows) {
      settingsObj[row.key] = row.value;
    }
    res.status(200).json({
      success: true,
      data: settingsObj,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/", (req: Request, res: Response): void => {
  const body = req.body;
  const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  
  const transaction = db.transaction((settingsObj) => {
    for (const [key, value] of Object.entries(settingsObj)) {
      stmt.run(key, String(value ?? ""));
    }
  });

  transaction(body);

  res.status(200).json({
    success: true,
    message: "Settings synchronized successfully",
  });
});

export default router;
