import { Router, Request, Response } from "express";
import { SyncQueueManager } from "../services/sync.service";
import { db } from "../db";
import { products, customers, sales, sale_items, inventory_logs, settings } from "../db/schema";
import { eq, and, sql, gt } from "drizzle-orm";
import { getTenantContext } from "../db/context";
import { ValidationError } from "../utils/errors";
import { InventoryMovementService } from "../services/inventory-movement.service";

const router = Router();
const movementService = new InventoryMovementService();

// POST upload offline-first delta changes
router.post("/upload", async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, currentStoreId } = getTenantContext();
    const orgId = organizationId;
    const storeId = currentStoreId;

    if (!orgId || !storeId) {
      res.status(401).json({ success: false, error: "Unauthorized: Missing organization or store context" });
      return;
    }

    const { sales: uploadedSales, customers: uploadedCustomers, adjustments: uploadedAdjustments } = req.body;

    await db.transaction(async (tx) => {
      // 1. Process Uploaded Customers
      if (uploadedCustomers && Array.isArray(uploadedCustomers)) {
        for (const cust of uploadedCustomers) {
          if (!cust.phone) continue;
          const [existing] = await tx
            .select()
            .from(customers)
            .where(and(eq(customers.phone, cust.phone), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
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
              .where(and(eq(customers.id, existing.id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)));
          } else {
            await tx.insert(customers).values({
              organization_id: orgId,
              store_id: storeId,
              name: cust.name || "Customer",
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
          if (!sale.invoice_number) continue;

          // Check for duplicate invoice in same tenant
          const [existingSale] = await tx
            .select()
            .from(sales)
            .where(and(eq(sales.invoice_number, sale.invoice_number), eq(sales.organization_id, orgId), eq(sales.store_id, storeId)))
            .limit(1);

          if (existingSale) {
            continue; // Prevent duplicate sales
          }

          // Resolve customer ID strictly in this organization
          let customerId: number | null = null;
          if (sale.customer_phone) {
            const [cust] = await tx
              .select()
              .from(customers)
              .where(and(eq(customers.phone, sale.customer_phone), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
              .limit(1);
            if (cust) customerId = cust.id;
          }

          // Insert Sale
          const [insertedSale] = await tx
            .insert(sales)
            .values({
              organization_id: orgId,
              store_id: storeId,
              invoice_number: sale.invoice_number,
              customer_id: customerId,
              cashier_name: sale.cashier_name ?? "Offline Client",
              payment_method: sale.payment_method || "Cash",
              payment_details: sale.payment_details ? JSON.stringify(sale.payment_details) : null,
              subtotal: sale.subtotal || 0,
              discount: sale.discount ?? 0,
              gst: sale.gst ?? 0,
              grand_total: sale.grand_total || 0,
              paid_amount: sale.paid_amount ?? sale.grand_total ?? 0,
              balance: sale.balance ?? 0,
              public_token: sale.public_token ?? null,
            })
            .returning();

          // Insert items & reduce stock (strictly validating product belongs to tenant)
          if (sale.items && Array.isArray(sale.items)) {
            for (const item of sale.items) {
              const [product] = await tx
                .select()
                .from(products)
                .where(and(eq(products.id, item.product_id), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
                .for("update");

              if (product) {
                // Record Sale movement using unified service
                await movementService.recordSale(
                  product.id,
                  storeId,
                  item.quantity,
                  sale.invoice_number,
                  sale.cashier_name || "Offline Cashier",
                  "Offline POS Sync Sale",
                  tx
                );

                // Insert sale item
                await tx.insert(sale_items).values({
                  organization_id: orgId,
                  store_id: storeId,
                  sale_id: insertedSale.id,
                  product_id: product.id,
                  quantity: item.quantity,
                  selling_price: item.selling_price || product.selling_price,
                  discount: item.discount ?? 0,
                  line_total: item.line_total || (item.selling_price || product.selling_price) * item.quantity,
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
            .where(and(eq(products.id, adj.product_id), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
            .for("update");

          if (product) {
            // Record stock adjustment using unified service
            const adjQty = adj.type === "ADD" ? adj.quantity : -adj.quantity;
            await movementService.recordStockAdjustment(
              product.id,
              storeId,
              adjQty,
              `Offline sync adjustment: ${adj.reason || ""}`,
              "System",
              tx
            );
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
    const { organizationId, currentStoreId } = getTenantContext();
    const orgId = organizationId;
    const storeId = currentStoreId;

    if (!orgId || !storeId) {
      res.status(401).json({ success: false, error: "Unauthorized: Missing organization or store context" });
      return;
    }

    const lastSyncTimeStr = req.query.lastSyncTime as string | undefined;

    let downloadCond: any = and(eq(products.organization_id, orgId), eq(products.store_id, storeId));
    let custCond: any = and(eq(customers.organization_id, orgId), eq(customers.store_id, storeId));
    let settingsCond: any = eq(settings.store_id, storeId);

    if (lastSyncTimeStr) {
      const lastSyncDate = new Date(lastSyncTimeStr);
      downloadCond = and(downloadCond, gt(products.updated_at, lastSyncDate));
      custCond = and(custCond, gt(customers.updated_at, lastSyncDate));
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
