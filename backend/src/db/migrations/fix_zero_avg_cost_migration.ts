import { db } from "../../db";
import { products, purchase_items, purchase_orders } from "../schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { logger } from "../../logger/logger";

export async function runZeroAvgCostMigration(txClient?: any): Promise<void> {
  const client = txClient || db;
  try {
    // 1. Find all active products where stock > 0 and average_cost = 0
    const invalidProducts = await client
      .select()
      .from(products)
      .where(and(gt(products.stock, 0), eq(products.average_cost, 0)));

    if (invalidProducts.length === 0) {
      logger.info("✅ [Migration] No legacy zero-average_cost products found.");
      return;
    }

    logger.info(`⏳ [Migration] Found ${invalidProducts.length} product(s) with stock > 0 and average_cost = 0. Repairing...`);

    for (const prod of invalidProducts) {
      let repairedAvgCost = prod.last_purchase_cost || 0;

      // If last_purchase_cost is also zero, check purchase_items history
      if (repairedAvgCost <= 0) {
        const [latestPurchaseItem] = await client
          .select({
            purchase_price: purchase_items.purchase_price,
          })
          .from(purchase_items)
          .where(eq(purchase_items.product_id, prod.id))
          .orderBy(desc(purchase_items.id))
          .limit(1);

        if (latestPurchaseItem && latestPurchaseItem.purchase_price > 0) {
          repairedAvgCost = latestPurchaseItem.purchase_price;
        }
      }

      if (repairedAvgCost > 0) {
        // Calculate margin and markup using the repaired average cost
        const sellingPrice = prod.selling_price || 0;
        const margin = sellingPrice > 0 ? Math.round(((sellingPrice - repairedAvgCost) / sellingPrice) * 100) : 0;
        const markup = Math.round(((sellingPrice - repairedAvgCost) / repairedAvgCost) * 100);

        await client
          .update(products)
          .set({
            average_cost: repairedAvgCost,
            last_purchase_cost: prod.last_purchase_cost || repairedAvgCost,
            margin_percent: margin,
            markup_percent: markup,
            updated_at: new Date(),
          })
          .where(eq(products.id, prod.id));

        logger.info(
          `🔧 [Migration] Repaired Product #${prod.id} (${prod.name}): stock=${prod.stock}, average_cost updated to ${repairedAvgCost} Paise.`
        );
      } else {
        logger.warn(
          `⚠️ [Migration] Product ID #${prod.id} (${prod.name}) has stock ${prod.stock} > 0, but no historical purchase cost found. Leaving average_cost = 0.`
        );
      }
    }

    logger.info("✅ [Migration] Zero-average_cost data repair migration complete.");
  } catch (error: any) {
    logger.error("❌ [Migration] Zero-average_cost data repair failed:", error?.message || error);
  }
}
