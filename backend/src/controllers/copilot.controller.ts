import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { products, sales, customers } from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError } from "../utils/errors";

export class CopilotController {
  query = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId() || 1;
      const { prompt } = req.body;
      if (!prompt) {
        throw new ValidationError("Prompt query is required for Copilot");
      }

      const lowerPrompt = prompt.toLowerCase();
      let answer = "";
      const data: any = {};

      if (lowerPrompt.includes("stock") || lowerPrompt.includes("inventory") || lowerPrompt.includes("reorder")) {
        // Query low stock
        const lowStock = await db
          .select()
          .from(products)
          .where(and(eq(products.store_id, storeId), sql`${products.stock} <= ${products.minimum_stock}`))
          .limit(5);

        if (lowStock.length === 0) {
          answer = "🟢 Great news! All active product stock levels are currently well above reorder limits.";
        } else {
          const list = lowStock.map((p) => `${p.name} (SKU: ${p.sku}) has ${p.stock} units remaining (min limit: ${p.minimum_stock}).`).join("\n- ");
          answer = `⚠️ Warning: I found ${lowStock.length} products near or below their reorder limits:\n- ${list}\n\nI suggest placing a procurement purchase order soon.`;
          data.lowStockItems = lowStock;
        }
      } else if (lowerPrompt.includes("sale") || lowerPrompt.includes("revenue") || lowerPrompt.includes("sold")) {
        // Query revenue
        const rows = await db
          .select({ total: sql<string>`SUM(${sales.grand_total})`, orders: sql<string>`COUNT(*)` })
          .from(sales)
          .where(eq(sales.store_id, storeId));

        const rev = Number(rows[0]?.total || 0) / 100.0;
        const count = Number(rows[0]?.orders || 0);

        answer = `📊 Sales Summary: You have processed ${count} checkout orders for a total revenue of ₹${rev.toFixed(2)}.`;
        data.totalRevenue = rev;
        data.ordersCount = count;
      } else if (lowerPrompt.includes("customer") || lowerPrompt.includes("crm")) {
        // Query top customers
        const rows = await db
          .select()
          .from(customers)
          .where(eq(customers.store_id, storeId))
          .orderBy(desc(customers.lifetime_value))
          .limit(3);

        if (rows.length === 0) {
          answer = "👥 No customer profiles registered in your database CRM yet.";
        } else {
          const list = rows.map((c) => `${c.name} (${c.phone}) - LTV: ₹${(c.lifetime_value / 100.0).toFixed(2)}`).join("\n- ");
          answer = `🏆 Top Customers Report:\n- ${list}`;
          data.topCustomers = rows;
        }
      } else if (lowerPrompt.includes("predict") || lowerPrompt.includes("forecast")) {
        // Sales Prediction
        const salesRows = await db
          .select({ total: sales.grand_total, date: sales.created_at })
          .from(sales)
          .where(eq(sales.store_id, storeId))
          .orderBy(desc(sales.id))
          .limit(30);

        if (salesRows.length < 3) {
          answer = "📈 Sales predictions require at least 3 historical transaction sales logs to establish moving average forecasting trends.";
        } else {
          const average = salesRows.reduce((acc, curr) => acc + curr.total, 0) / salesRows.length / 100.0;
          const predictedNextMonth = average * 30 * 1.05; // 5% growth factor
          answer = `🔮 AI Forecasting Engine: Based on your last ${salesRows.length} transactions, I predict next month's gross retail sales to hit approximately ₹${predictedNextMonth.toFixed(2)} (assuming a standard 5% month-on-month trend variance).`;
          data.predictedMonthlyRevenue = predictedNextMonth;
        }
      } else {
        answer = "👋 Hello! I am your Apka Bill Assistant Copilot. I can query store analytics, alert you to low stock, predict sales patterns, or fetch customer data. Try asking: 'Is my stock low?', 'What is my total sales revenue?', or 'Predict next month sales'.";
      }

      res.status(200).json({
        success: true,
        answer,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
