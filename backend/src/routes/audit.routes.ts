import { Router } from "express";
import { db } from "../db";
import { audit_logs } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { authorize } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authorize("admin", "manager"), async (req, res, next) => {
  try {
    const storeId = getStoreId();
    if (storeId === undefined) {
      res.status(400).json({ success: false, error: "Store context is required" });
      return;
    }
    const rows = await db
      .select()
      .from(audit_logs)
      .where(eq(audit_logs.store_id, storeId))
      .orderBy(desc(audit_logs.id))
      .limit(100); // Return up to latest 100 entries

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
