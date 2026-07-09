import { Router, Request, Response } from "express";
import db from "../database/db";

const router = Router();

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
