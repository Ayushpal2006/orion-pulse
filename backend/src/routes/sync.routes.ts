import { Router, Request, Response } from "express";
import { SyncQueueManager } from "../services/sync.service";
import { db } from "../db";
import { products, customers, sales, sale_items, inventory_logs, settings } from "../db/schema";
import { eq, and, sql, gt } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError } from "../utils/errors";

const router = Router();

// POST upload offline-first delta changes
router.post("/upload", async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = getStoreId() || 1;
    const { sales: uploadedSales, customers: uploadedCustomers, adjustments: uploadedAdjustments } = req.body;

    await db.transaction(async (tx) => {
      // 1. Process Uploaded Customers
      if (uploadedCustomers && Array.isArray(uploadedCustomers)) {
        for (const cust of uploadedCustomers) {
          const [existing] = await tx
            .select()
            .from(customers)
            .where(and(eq(customers.phone, cust.phone), eq(customers.store_id, storeId)))
            .limit(1);

          if (existing) {
            // Newest wins
            await tx
              .update(customers)
              .set({
                name: cust.name,
                email: cust.email ?? existing.email,
                address: cust.address ?? existing.address,
                notes: cust.notes ?? existing.notes,
                total_orders: Math.max(existing.total_orders, cust.total_orders ?? 0),
                lifetime_value: Math.max(existing.lifetime_value, cust.lifetime_value ?? 0),
                last_visit: cust.last_visit ? new Date(cust.last_visit) : existing.last_visit,
                updated_at: new Date(),
              })
              .where(eq(customers.id, existing.id));
          } else {
            await tx.insert(customers).values({
              store_id: storeId,
              name: cust.name,
              phone: cust.phone,
              email: cust.email ?? null,
              address: cust.address ?? null,
              notes: cust.notes ?? null,
              total_orders: cust.total_orders ?? 0,
              lifetime_value: cust.lifetime_value ?? 0,
              last_visit: cust.last_visit ? new Date(cust.last_visit) : null,
              is_active: 1,
            });
          }
        }
      }

      // 2. Process Uploaded Sales (Invoices)
      if (uploadedSales && Array.isArray(uploadedSales)) {
        for (const sale of uploadedSales) {
          // Check for duplicate invoice
          const [existingSale] = await tx
            .select()
            .from(sales)
            .where(and(eq(sales.invoice_number, sale.invoice_number), eq(sales.store_id, storeId)))
            .limit(1);

          if (existingSale) {
            continue; // Prevent duplicate sales
          }

          // Resolve customer ID
          let customerId: number | null = null;
          if (sale.customer_phone) {
            const [cust] = await tx
              .select()
              .from(customers)
              .where(and(eq(customers.phone, sale.customer_phone), eq(customers.store_id, storeId)))
              .limit(1);
            if (cust) customerId = cust.id;
          }

          // Insert Sale
          const [insertedSale] = await tx
            .insert(sales)
            .values({
              store_id: storeId,
              invoice_number: sale.invoice_number,
              customer_id: customerId,
              cashier_name: sale.cashier_name ?? "Offline Client",
              payment_method: sale.payment_method,
              payment_details: sale.payment_details ? JSON.stringify(sale.payment_details) : null,
              subtotal: sale.subtotal,
              discount: sale.discount ?? 0,
              gst: sale.gst ?? 0,
              grand_total: sale.grand_total,
              paid_amount: sale.paid_amount ?? sale.grand_total,
              balance: sale.balance ?? 0,
              public_token: sale.public_token ?? null,
            })
            .returning();

          // Insert items & reduce stock
          if (sale.items && Array.isArray(sale.items)) {
            for (const item of sale.items) {
              const [product] = await tx
                .select()
                .from(products)
                .where(and(eq(products.id, item.product_id), eq(products.store_id, storeId)))
                .for("update");

              if (product) {
                const beforeStock = product.stock;
                const afterStock = Math.max(0, beforeStock - item.quantity);

                // Update product stock
                await tx
                  .update(products)
                  .set({ stock: afterStock, updated_at: new Date() })
                  .where(eq(products.id, product.id));

                // Log inventory log (SALE type)
                await tx.insert(inventory_logs).values({
                  product_id: product.id,
                  store_id: storeId,
                  type: "SALE",
                  quantity: item.quantity,
                  before_stock: beforeStock,
                  after_stock: afterStock,
                  reference: sale.invoice_number,
                });

                // Insert sale item
                await tx.insert(sale_items).values({
                  sale_id: insertedSale.id,
                  product_id: product.id,
                  quantity: item.quantity,
                  selling_price: item.selling_price,
                  discount: item.discount ?? 0,
                  line_total: item.line_total,
                });
              }
            }
          }
        }
      }

      // 3. Process Uploaded Adjustments
      if (uploadedAdjustments && Array.isArray(uploadedAdjustments)) {
        for (const adj of uploadedAdjustments) {
          const [product] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, adj.product_id), eq(products.store_id, storeId)))
            .for("update");

          if (product) {
            const beforeStock = product.stock;
            let afterStock = beforeStock;
            if (adj.type === "ADD") afterStock = beforeStock + adj.quantity;
            else if (adj.type === "REMOVE") afterStock = Math.max(0, beforeStock - adj.quantity);

            await tx
              .update(products)
              .set({ stock: afterStock, updated_at: new Date() })
              .where(eq(products.id, product.id));

            await tx.insert(inventory_logs).values({
              product_id: product.id,
              store_id: storeId,
              type: "ADJUSTMENT",
              quantity: adj.type === "ADD" ? adj.quantity : -adj.quantity,
              before_stock: beforeStock,
              after_stock: afterStock,
              reference: `Offline sync adjustment: ${adj.reason}`,
            });
          }
        }
      }
    });

    res.status(200).json({ success: true, message: "Offline data synchronized successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET download offline-first delta changes
router.get("/download", async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = getStoreId() || 1;
    const lastSyncTimeStr = req.query.lastSyncTime as string | undefined;

    let downloadCond = eq(products.store_id, storeId);
    let custCond = eq(customers.store_id, storeId);
    let settingsCond = eq(settings.store_id, storeId);

    if (lastSyncTimeStr) {
      const lastSyncDate = new Date(lastSyncTimeStr);
      downloadCond = and(downloadCond, gt(products.updated_at, lastSyncDate)) as any;
      custCond = and(custCond, gt(customers.updated_at, lastSyncDate)) as any;
    }

    const updatedProducts = await db.select().from(products).where(downloadCond);
    const updatedCustomers = await db.select().from(customers).where(custCond);
    const updatedSettings = await db.select().from(settings).where(settingsCond);

    res.status(200).json({
      success: true,
      data: {
        products: updatedProducts,
        customers: updatedCustomers,
        settings: updatedSettings,
        syncTime: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    const result = await manager.testConnection(sheetId);
    res.status(200).json({
      success: true,
      connected: result.success,
      error: result.error
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
