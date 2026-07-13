import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { organizations, sales, products } from "../db/schema";
import { eq, count } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError, NotFoundError } from "../utils/errors";

export class SubscriptionController {
  getPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId() || 1;
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, 1)) // default organization context
        .limit(1);

      if (!org) {
        throw new NotFoundError("Organization not found");
      }

      // Check current usage limits
      const [salesCount] = await db.select({ count: count() }).from(sales).where(eq(sales.store_id, storeId));
      const [productsCount] = await db.select({ count: count() }).from(products).where(eq(products.store_id, storeId));

      // Limit thresholds mapping
      const limits: Record<string, { maxSales: number; maxProducts: number }> = {
        Basic: { maxSales: 500, maxProducts: 100 },
        Professional: { maxSales: 5000, maxProducts: 1000 },
        Enterprise: { maxSales: 999999, maxProducts: 999999 },
      };

      const planLimits = limits[org.billing_plan] || limits.Basic;

      res.status(200).json({
        success: true,
        data: {
          billingPlan: org.billing_plan,
          subscriptionStatus: org.subscription_status,
          razorpaySubscriptionId: org.razorpay_subscription_id,
          usage: {
            sales: {
              current: Number(salesCount?.count || 0),
              limit: planLimits.maxSales,
            },
            products: {
              current: Number(productsCount?.count || 0),
              limit: planLimits.maxProducts,
            },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { event, payload } = req.body;
      if (!event || !payload) {
        throw new ValidationError("Invalid Razorpay webhook payload structure");
      }

      // Process subscription status updates from Razorpay payload details
      // Example event: subscription.charged, subscription.activated, subscription.halted
      const subId = payload.subscription?.entity?.id;
      const status = payload.subscription?.entity?.status; // active, halted, cancelled
      const planId = payload.subscription?.entity?.plan_id; // plan identifier

      if (subId && status) {
        let billingPlan = "Basic";
        if (planId === "plan_pro_001") billingPlan = "Professional";
        else if (planId === "plan_ent_001") billingPlan = "Enterprise";

        await db
          .update(organizations)
          .set({
            billing_plan: billingPlan,
            subscription_status: status === "active" ? "active" : "halted",
            razorpay_subscription_id: subId,
          })
          .where(eq(organizations.id, 1)); // default organization context
      }

      res.status(200).json({ success: true, message: "Webhook processed successfully" });
    } catch (error) {
      next(error);
    }
  };
}
