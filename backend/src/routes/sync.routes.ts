import { Router, Request, Response } from "express";
import { SyncQueueManager } from "../services/sync.service";
import { db } from "../db";
import { products, customers, sales, sale_items, inventory_logs, settings, suppliers, purchase_orders, purchase_items, expenses, inventory_adjustments } from "../db/schema";
import { eq, and, or, sql, gt, inArray } from "drizzle-orm";
import { getTenantContext } from "../db/context";
import { ValidationError } from "../utils/errors";
import { InventoryMovementService } from "../services/inventory-movement.service";

const router = Router();
const movementService = new InventoryMovementService();

/** True when a JSON value carries a usable number (not undefined / null / ""). */
const hasValue = (v: unknown): boolean => v !== undefined && v !== null && v !== "";

/**
 * Converts a RUPEE amount from a client payload into integer PAISE for storage.
 * Non-numeric / missing input yields 0. This is the only unit conversion allowed on the
 * sync-upload path; the unit is fixed by contract, never guessed from the value.
 */
const rupeesToPaise = (v: unknown): number => {
  if (!hasValue(v)) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

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

    const {
      sales: uploadedSales,
      customers: uploadedCustomers,
      adjustments: uploadedAdjustments,
      suppliers: uploadedSuppliers,
      purchases: uploadedPurchases,
      expenses: uploadedExpenses,
    } = req.body;

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

      // 2. Process Uploaded Suppliers (P2)
      if (uploadedSuppliers && Array.isArray(uploadedSuppliers)) {
        for (const supp of uploadedSuppliers) {
          if (!supp.name) continue;
          const suppPhone = supp.phone ? String(supp.phone).trim() : null;
          let existing: any = null;
          if (suppPhone) {
            [existing] = await tx
              .select()
              .from(suppliers)
              .where(and(eq(suppliers.phone, suppPhone), eq(suppliers.organization_id, orgId), eq(suppliers.store_id, storeId)))
              .limit(1);
          }

          if (existing) {
            await tx
              .update(suppliers)
              .set({
                company_name: supp.name || supp.company_name,
                contact_person: supp.contact_person ?? existing.contact_person,
                email: supp.email ?? existing.email,
                address: supp.address ?? existing.address,
                gst_number: supp.gstin ?? supp.gst_number ?? existing.gst_number,
                updated_at: new Date(),
              })
              .where(and(eq(suppliers.id, existing.id), eq(suppliers.organization_id, orgId), eq(suppliers.store_id, storeId)));
          } else {
            await tx.insert(suppliers).values({
              organization_id: orgId,
              store_id: storeId,
              supplier_code: supp.supplier_code || `SUP-${Date.now().toString().slice(-6)}`,
              company_name: supp.name || supp.company_name || "Supplier",
              contact_person: supp.contact_person ?? null,
              phone: suppPhone,
              email: supp.email ?? null,
              address: supp.address ?? null,
              gst_number: supp.gstin ?? supp.gst_number ?? null,
              is_active: 1,
            });
          }
        }
      }

      // 3. Process Uploaded Purchases (P2)
      if (uploadedPurchases && Array.isArray(uploadedPurchases)) {
        for (const po of uploadedPurchases) {
          const poNumber = po.po_number || po.invoice_number || `PO-${Date.now()}`;
          const [existingPO] = await tx
            .select()
            .from(purchase_orders)
            .where(and(eq(purchase_orders.po_number, poNumber), eq(purchase_orders.organization_id, orgId), eq(purchase_orders.store_id, storeId)))
            .limit(1);

          if (existingPO) {
            console.log(`[SYNC] Purchase ${poNumber} already exists in store ${storeId}. Skipping duplicate.`);
            continue;
          }

          // Resolve supplier
          let supplierId: number | null = null;
          if (po.supplier_id && !isNaN(parseInt(String(po.supplier_id), 10))) {
            const [s] = await tx.select().from(suppliers).where(and(eq(suppliers.id, parseInt(String(po.supplier_id), 10)), eq(suppliers.store_id, storeId))).limit(1);
            if (s) supplierId = s.id;
          }
          if (!supplierId && po.supplier_name) {
            const [s] = await tx.select().from(suppliers).where(and(eq(suppliers.company_name, po.supplier_name), eq(suppliers.store_id, storeId))).limit(1);
            if (s) {
              supplierId = s.id;
            } else {
              const [newS] = await tx.insert(suppliers).values({
                organization_id: orgId,
                store_id: storeId,
                supplier_code: `SUP-${Date.now().toString().slice(-6)}`,
                company_name: po.supplier_name,
                is_active: 1,
              }).returning();
              if (newS) supplierId = newS.id;
            }
          }

          if (!supplierId) {
            const [firstS] = await tx.select().from(suppliers).where(and(eq(suppliers.organization_id, orgId), eq(suppliers.store_id, storeId))).limit(1);
            supplierId = firstS?.id || 1;
          }

          const grandTotal = Math.round(Number(po.total_amount || po.grand_total || 0));
          const [createdPO] = await tx
            .insert(purchase_orders)
            .values({
              organization_id: orgId,
              store_id: storeId,
              supplier_id: supplierId,
              po_number: poNumber,
              invoice_number: po.invoice_number || null,
              status: po.status || "COMPLETED",
              subtotal: grandTotal,
              discount: 0,
              gst: 0,
              grand_total: grandTotal,
              net_amount: grandTotal,
              payment_status: "Paid",
              payment_method: po.payment_method || "Cash",
            })
            .returning();

          if (po.items && Array.isArray(po.items)) {
            for (const item of po.items) {
              let prodId = item.product_id || item.productId;
              if (prodId) {
                const [prod] = await tx.select().from(products).where(and(eq(products.id, prodId), eq(products.store_id, storeId))).limit(1);
                if (prod) {
                  const qty = Number(item.quantity) || 1;
                  const costPrice = Math.round(Number(item.cost_price || item.costPrice || prod.purchase_price));
                  await tx.insert(purchase_items).values({
                    organization_id: orgId,
                    store_id: storeId,
                    purchase_order_id: createdPO.id,
                    product_id: prod.id,
                    quantity: qty,
                    received_quantity: qty,
                    purchase_price: costPrice,
                    line_total: costPrice * qty,
                  });
                  // Adjust product stock
                  await movementService.recordPurchase(
                    prod.id,
                    storeId,
                    qty,
                    poNumber,
                    "System",
                    "Offline POS Sync Purchase",
                    undefined,
                    tx
                  );
                }
              }
            }
          }
        }
      }

      // 4. Process Uploaded Expenses (P2)
      if (uploadedExpenses && Array.isArray(uploadedExpenses)) {
        for (const exp of uploadedExpenses) {
          const expAmount = Math.round(Number(exp.amount || 0));
          await tx.insert(expenses).values({
            organization_id: orgId,
            store_id: storeId,
            category_id: 1, // Default general category
            amount: expAmount,
            payment_method: exp.payment_mode || exp.payment_method || "Cash",
            description: exp.notes || exp.description || exp.category || "Expense",
            date: exp.date ? new Date(exp.date) : new Date(),
          });
        }
      }

      // 5. Process Uploaded Sales (Invoices)
      if (uploadedSales && Array.isArray(uploadedSales)) {
        for (const sale of uploadedSales) {
          if (!sale.invoice_number) continue;

          // Serialize uploads of the same invoice: a client retry after a timeout can arrive while the
          // first request's transaction is still open, and the read-then-insert check below would miss it.
          await tx.execute(sql`select pg_advisory_xact_lock(${storeId}, hashtext(${String(sale.invoice_number)}))`);

          // Check for duplicate invoice in same tenant
          const [existingSale] = await tx
            .select()
            .from(sales)
            .where(and(eq(sales.invoice_number, sale.invoice_number), eq(sales.organization_id, orgId), eq(sales.store_id, storeId)))
            .limit(1);

          if (existingSale) {
            console.log(`[SYNC] Invoice ${sale.invoice_number} already exists in store ${storeId}. Skipping duplicate.`);
            continue; // Prevent duplicate sales
          }

          // Resolve customer ID strictly in this organization/store
          let customerId: number | null = null;
          const phoneToLookup = sale.customer_phone || sale.customerPhone;
          const rawCustName = sale.customer_name || sale.customerName;

          if (phoneToLookup && String(phoneToLookup).trim() !== '' && String(phoneToLookup) !== '0000000000') {
            const cleanPhone = String(phoneToLookup).trim();
            const [cust] = await tx
              .select()
              .from(customers)
              .where(and(eq(customers.phone, cleanPhone), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
              .limit(1);

            if (cust) {
              customerId = cust.id;
            } else {
              // Customer with phone does not exist in backend yet -> Auto-upsert/create in PostgreSQL
              try {
                const [newCust] = await tx
                  .insert(customers)
                  .values({
                    organization_id: orgId,
                    store_id: storeId,
                    name: rawCustName || "Customer",
                    phone: cleanPhone,
                    is_active: 1,
                    created_at: new Date(),
                    updated_at: new Date(),
                  })
                  .returning();
                if (newCust) customerId = newCust.id;
              } catch (custInsertErr) {
                // If race condition on phone unique constraint, re-fetch
                const [retryCust] = await tx
                  .select()
                  .from(customers)
                  .where(and(eq(customers.phone, cleanPhone), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
                  .limit(1);
                if (retryCust) customerId = retryCust.id;
              }
            }
          } else if (sale.customer_id) {
            // Verify if provided customer_id actually exists in PostgreSQL before using it
            const rawId = parseInt(String(sale.customer_id), 10);
            if (!isNaN(rawId) && rawId > 0) {
              const [custById] = await tx
                .select()
                .from(customers)
                .where(and(eq(customers.id, rawId), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
                .limit(1);
              if (custById) {
                customerId = custById.id;
              }
            }
          }

          // Fallback: If named customer but no phone, lookup by name
          if (!customerId && rawCustName && rawCustName !== 'Walk-in Customer' && rawCustName !== 'Walk-in') {
            const [custByName] = await tx
              .select()
              .from(customers)
              .where(and(eq(customers.name, String(rawCustName)), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
              .limit(1);
            if (custByName) customerId = custByName.id;
          }

          // MONEY CONTRACT: every monetary field in an uploaded sale is in RUPEES (the mobile
          // outbox serialises paise / 100). The database stores integer PAISE, so convert here
          // exactly once. Never infer the unit from the magnitude of the value.
          const cleanSubtotal = rupeesToPaise(sale.subtotal);
          const cleanDiscount = rupeesToPaise(sale.discount);
          const cleanGst = rupeesToPaise(hasValue(sale.gst) ? sale.gst : sale.tax);
          const cleanGrandTotal = rupeesToPaise(hasValue(sale.grand_total) ? sale.grand_total : sale.total_amount);
          const rawPaid = hasValue(sale.paid_amount) ? sale.paid_amount : sale.amount_paid;
          const cleanPaidAmount = hasValue(rawPaid) ? rupeesToPaise(rawPaid) : cleanGrandTotal;
          const cleanBalance = hasValue(sale.balance) ? rupeesToPaise(sale.balance) : Math.max(0, cleanGrandTotal - cleanPaidAmount);

          // Insert Sale
          const [createdSale] = await tx
            .insert(sales)
            .values({
              organization_id: orgId,
              store_id: storeId,
              invoice_number: sale.invoice_number,
              customer_id: customerId,
              cashier_name: sale.cashier_name || "Offline Client",
              payment_method: sale.payment_method || "Cash",
              payment_details: typeof sale.payment_details === 'object' ? JSON.stringify(sale.payment_details) : (sale.payment_details || null),
              subtotal: cleanSubtotal,
              discount: cleanDiscount,
              gst: cleanGst,
              grand_total: cleanGrandTotal,
              paid_amount: cleanPaidAmount,
              balance: cleanBalance,
              status: (sale.status === 'VOID' || sale.status === 'voided') ? 'VOID' : 'COMPLETED',
              created_at: sale.created_at ? new Date(sale.created_at) : new Date(),
            })
            .returning();

          // Insert items (strictly validating product belongs to tenant)
          if (sale.items && Array.isArray(sale.items)) {
            for (const item of sale.items) {
              let prodRow: { id: number; gst: number | null } | null = null;
              if (item.product_id && !isNaN(parseInt(String(item.product_id), 10))) {
                const checkProd = await tx
                  .select({ id: products.id, gst: products.gst })
                  .from(products)
                  .where(and(eq(products.id, parseInt(String(item.product_id), 10)), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
                  .limit(1);
                if (checkProd.length > 0) prodRow = checkProd[0];
              }

              if (!prodRow && item.product_name) {
                const checkByName = await tx
                  .select({ id: products.id, gst: products.gst })
                  .from(products)
                  .where(and(eq(products.name, String(item.product_name)), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
                  .limit(1);
                if (checkByName.length > 0) prodRow = checkByName[0];
              }

              if (!prodRow) {
                const firstProd = await tx
                  .select({ id: products.id, gst: products.gst })
                  .from(products)
                  .where(and(eq(products.organization_id, orgId), eq(products.store_id, storeId)))
                  .limit(1);
                // Never fall back to a hard-coded product id: it may belong to another organization.
                if (firstProd.length === 0) {
                  throw new Error(`Offline sale ${sale.invoice_number}: no product found in store ${storeId}`);
                }
                prodRow = firstProd[0];
              }
              const prodId = prodRow.id;

              // Line amounts arrive in RUPEES; sale_items stores PAISE (same rules as CheckoutService).
              const itemQty = Math.max(1, Math.round(Number(item.quantity) || 1));
              const unitPricePaise = rupeesToPaise(
                hasValue(item.selling_price) ? item.selling_price : hasValue(item.unit_price) ? item.unit_price : item.unitPrice
              );
              const lineGrossPaise = unitPricePaise * itemQty;

              // Line discount: explicit rupee amount wins; otherwise a percentage. The legacy mobile
              // outbox field `discount` has always carried the line discount PERCENT (0-100).
              let lineDiscountPaise = 0;
              if (hasValue(item.discount_amount)) {
                lineDiscountPaise = rupeesToPaise(item.discount_amount);
              } else if (hasValue(item.discount_percent)) {
                lineDiscountPaise = Math.round((lineGrossPaise * Number(item.discount_percent)) / 100);
              } else if (hasValue(item.discount)) {
                lineDiscountPaise = Math.round((lineGrossPaise * Number(item.discount)) / 100);
              }
              lineDiscountPaise = Math.min(lineGrossPaise, Math.max(0, lineDiscountPaise));

              const lineTaxablePaise = lineGrossPaise - lineDiscountPaise;
              const gstRate = prodRow.gst !== undefined && prodRow.gst !== null ? Number(prodRow.gst) : 18;
              const lineGstPaise = Math.round((lineTaxablePaise * gstRate) / 100);
              const lineTotal = lineTaxablePaise + lineGstPaise;

              await tx.insert(sale_items).values({
                organization_id: orgId,
                store_id: storeId,
                sale_id: createdSale.id,
                product_id: prodId,
                quantity: itemQty,
                selling_price: unitPricePaise,
                discount: lineDiscountPaise,
                line_total: lineTotal,
              });
            }
          }
        }
      }

      // 6. Process Uploaded Adjustments
      if (uploadedAdjustments && Array.isArray(uploadedAdjustments)) {
        for (const adj of uploadedAdjustments) {
          const adjProdId = adj.product_id && !isNaN(parseInt(String(adj.product_id), 10)) ? parseInt(String(adj.product_id), 10) : null;
          if (!adjProdId) continue;

          const [product] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, adjProdId), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
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
    const cause = error?.cause || {};
    console.error("SYNC UPLOAD FAILED", {
      message: error?.message,
      code: error?.code || cause?.code,
      constraint: error?.constraint || cause?.constraint,
      detail: error?.detail || cause?.detail,
      table: error?.table || cause?.table,
      column: error?.column || cause?.column,
      schema: error?.schema || cause?.schema,
      causeMessage: cause?.message,
      stack: error?.stack,
    });
    res.status(500).json({ success: false, error: error.message, detail: error.detail || cause?.detail });
  }
});

// GET download/pull offline-first delta changes
// Pull pagination. Sales, purchases and expenses are paged by ascending id (keyset), because they
// can be large. Everything else (products, customers, suppliers, settings) is returned in full on
// the first page only. A client must keep requesting pages while `sync.hasMore` is true, passing back
// `sync.nextCursor` and `sweepStart`, and must only persist `syncTime` once `hasMore` is false.
const PULL_DEFAULT_PAGE_SIZE = 500;
const PULL_MAX_PAGE_SIZE = 1000;
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

const parsePositiveInt = (raw: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number => {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
};

const handlePullSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, currentStoreId } = getTenantContext();
    const orgId = organizationId;
    const storeId = currentStoreId;

    if (!orgId || !storeId) {
      res.status(401).json({
        success: false,
        errorCode: "UNAUTHORIZED",
        error: "Unauthorized: Missing organization or store context",
      });
      return;
    }

    const lastSyncTimeStr = req.query.lastSyncTime as string | undefined;

    const afterSalesId = parsePositiveInt(req.query.afterSalesId, 0);
    const afterPurchasesId = parsePositiveInt(req.query.afterPurchasesId, 0);
    const afterExpensesId = parsePositiveInt(req.query.afterExpensesId, 0);
    const isFirstPage = afterSalesId === 0 && afterPurchasesId === 0 && afterExpensesId === 0;
    // Clients that send no paging params (the shipped Expo app) never read hasMore, so paging them
    // would re-pull the same first page forever. Give them the whole delta in one response.
    const legacyClient = req.query.pageSize === undefined && req.query.sweepStart === undefined && isFirstPage;
    const pageSize = legacyClient
      ? Number.MAX_SAFE_INTEGER - 1
      : Math.max(1, parsePositiveInt(req.query.pageSize, PULL_DEFAULT_PAGE_SIZE, PULL_MAX_PAGE_SIZE));

    // The sweep start time is the cursor to persist once every page has been fetched. Taking it
    // before any query runs means rows written during the sweep are re-delivered next time, never lost.
    const requestedSweepStart = req.query.sweepStart ? new Date(String(req.query.sweepStart)) : null;
    const sweepStart =
      requestedSweepStart && !Number.isNaN(requestedSweepStart.getTime()) ? requestedSweepStart : new Date();

    let downloadCond: any = and(eq(products.organization_id, orgId), eq(products.store_id, storeId));
    let custCond: any = and(eq(customers.organization_id, orgId), eq(customers.store_id, storeId));
    let settingsCond: any = eq(settings.store_id, storeId);
    let salesCond: any = and(eq(sales.organization_id, orgId), eq(sales.store_id, storeId));
    let suppCond: any = and(eq(suppliers.organization_id, orgId), eq(suppliers.store_id, storeId));
    let poCond: any = and(eq(purchase_orders.organization_id, orgId), eq(purchase_orders.store_id, storeId));
    let expCond: any = and(eq(expenses.organization_id, orgId), eq(expenses.store_id, storeId));

    if (lastSyncTimeStr) {
      const lastSyncDate = new Date(lastSyncTimeStr);
      downloadCond = and(downloadCond, gt(products.updated_at, lastSyncDate));
      settingsCond = and(settingsCond, gt(settings.updated_at, lastSyncDate));
      custCond = and(custCond, gt(customers.updated_at, lastSyncDate));
      salesCond = and(salesCond, or(gt(sales.created_at, lastSyncDate), gt(sales.voided_at, lastSyncDate)));
      suppCond = and(suppCond, gt(suppliers.updated_at, lastSyncDate));
      poCond = and(poCond, gt(purchase_orders.updated_at, lastSyncDate));
      expCond = and(expCond, gt(expenses.updated_at, lastSyncDate));
    }

    if (afterSalesId > 0) salesCond = and(salesCond, gt(sales.id, afterSalesId));
    if (afterPurchasesId > 0) poCond = and(poCond, gt(purchase_orders.id, afterPurchasesId));
    if (afterExpensesId > 0) expCond = and(expCond, gt(expenses.id, afterExpensesId));

    // Unpaged collections are sent once, on the first page of a sweep.
    const updatedProducts = isFirstPage ? await db.select().from(products).where(downloadCond) : [];
    const updatedCustomers = isFirstPage ? await db.select().from(customers).where(custCond) : [];
    const updatedSettings = isFirstPage ? await db.select().from(settings).where(settingsCond) : [];
    const updatedSuppliers = isFirstPage ? await db.select().from(suppliers).where(suppCond) : [];

    // Fetch one extra row per paged collection to learn whether more remain.
    const salesPage = await db.select().from(sales).where(salesCond).orderBy(sql`${sales.id} ASC`).limit(pageSize + 1);
    const purchasesPage = await db.select().from(purchase_orders).where(poCond).orderBy(sql`${purchase_orders.id} ASC`).limit(pageSize + 1);
    const expensesPage = await db.select().from(expenses).where(expCond).orderBy(sql`${expenses.id} ASC`).limit(pageSize + 1);

    const hasMore = salesPage.length > pageSize || purchasesPage.length > pageSize || expensesPage.length > pageSize;
    const updatedSales = salesPage.slice(0, pageSize);
    const updatedPurchases = purchasesPage.slice(0, pageSize);
    const updatedExpenses = expensesPage.slice(0, pageSize);

    const saleIds = updatedSales.map((s) => s.id);
    let updatedSaleItems: any[] = [];
    if (saleIds.length > 0) {
      updatedSaleItems = await db
        .select()
        .from(sale_items)
        .where(and(eq(sale_items.store_id, storeId), inArray(sale_items.sale_id, saleIds)));
    }

    const poIds = updatedPurchases.map((p) => p.id);
    let updatedPOItems: any[] = [];
    if (poIds.length > 0) {
      updatedPOItems = await db
        .select()
        .from(purchase_items)
        .where(and(eq(purchase_items.store_id, storeId), inArray(purchase_items.purchase_order_id, poIds)));
    }

    // Embed items array into each sale and purchase object
    const salesWithItems = updatedSales.map((s) => ({
      ...s,
      items: updatedSaleItems.filter((item) => item.sale_id === s.id),
    }));

    const purchasesWithItems = updatedPurchases.map((p) => ({
      ...p,
      items: updatedPOItems.filter((item) => item.purchase_order_id === p.id),
    }));

    const nowIso = sweepStart.toISOString();
    const lastOf = (rows: Array<{ id: number }>, previous: number): number =>
      rows.length > 0 ? rows[rows.length - 1].id : previous;
    const nextCursor = {
      afterSalesId: lastOf(updatedSales, afterSalesId),
      afterPurchasesId: lastOf(updatedPurchases, afterPurchasesId),
      afterExpensesId: lastOf(updatedExpenses, afterExpensesId),
    };
    // While pages remain, never advance a non-paging client's saved cursor past undelivered rows:
    // hand back the time it asked from (or the epoch), so at worst it re-pulls rather than loses data.
    const syncTimeForClient = hasMore ? lastSyncTimeStr || EPOCH_ISO : nowIso;

    res.status(200).json({
      success: true,
      data: {
        context: {
          organizationId: orgId,
          storeId: storeId,
        },
        products: updatedProducts,
        customers: updatedCustomers,
        suppliers: updatedSuppliers,
        purchases: purchasesWithItems,
        expenses: updatedExpenses,
        settings: updatedSettings,
        sales: salesWithItems,
        saleItems: updatedSaleItems,
        sync: {
          cursor: syncTimeForClient,
          syncTime: syncTimeForClient,
          sweepStart: nowIso,
          hasMore,
          pageSize,
          nextCursor: hasMore ? nextCursor : null,
          counts: {
            products: updatedProducts.length,
            customers: updatedCustomers.length,
            suppliers: updatedSuppliers.length,
            purchases: purchasesWithItems.length,
            expenses: updatedExpenses.length,
            sales: updatedSales.length,
            saleItems: updatedSaleItems.length,
            settings: updatedSettings.length,
          },
        },
        syncTime: syncTimeForClient,
        sweepStart: nowIso,
        hasMore,
        nextCursor: hasMore ? nextCursor : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorCode: "DELTA_PULL_FAILED",
      error: error.message,
    });
  }
};

router.get("/download", handlePullSync);
router.get("/pull", handlePullSync);

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
