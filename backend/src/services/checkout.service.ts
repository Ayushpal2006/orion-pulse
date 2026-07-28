import { db } from "../db";
import { sales, sale_items, products, customers, inventory_logs, audit_logs } from "../db/schema";
import { eq, and, desc, like } from "drizzle-orm";
import { CheckoutRequest, CheckoutResponse } from "../types/checkout.types";
import { ValidationError, NotFoundError } from "../utils/errors";
import { getStoreId, getOrganizationId, getUserId } from "../db/context";
import { getKolkataDateString } from "../utils/datetime";
import { formatInTimeZone } from "date-fns-tz";
import { settingsRepository, customerRepository } from "../repositories";
import { InventoryMovementService } from "./inventory-movement.service";

const idempotencyCache = new Map<string, { timestamp: number; response: any }>();

// Clean up stale cache keys periodically
if (typeof global !== "undefined" && typeof setInterval === "function") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of idempotencyCache.entries()) {
      if (now - val.timestamp > 10000) {
        idempotencyCache.delete(key);
      }
    }
  }, 30000).unref?.();
}

export class CheckoutService {
  private movementService = new InventoryMovementService();

  async generateNextInvoiceNumber(storeId: number, txClient?: any): Promise<string> {
    const client = txClient || db;
    const todayStr = getKolkataDateString();
    
    // Load configured prefix setting dynamically from DB
    const rawPrefix = await settingsRepository.get("inv_prefix", "INV-");
    const basePrefix = rawPrefix && rawPrefix.trim() !== "" ? rawPrefix.trim() : "INV-";
    
    const prefix = basePrefix.endsWith("-") || basePrefix.endsWith("/")
      ? `${basePrefix}${todayStr}-`
      : `${basePrefix}-${todayStr}-`;

    const rows = await client
      .select({ invoice_number: sales.invoice_number })
      .from(sales)
      .where(and(eq(sales.store_id, storeId), like(sales.invoice_number, `${prefix}%`)))
      .orderBy(desc(sales.id))
      .limit(1);

    let nextSeq = 1;
    if (rows[0]) {
      const parts = rows[0].invoice_number.split("-");
      if (parts.length >= 3) {
        const lastPart = parts[parts.length - 1];
        const seqNum = parseInt(lastPart, 10);
        if (!isNaN(seqNum)) {
          nextSeq = seqNum + 1;
        }
      }
    }

    const seqStr = String(nextSeq).padStart(6, "0");
    return `${prefix}${seqStr}`;
  }

  async executeCheckout(request: CheckoutRequest & { paymentDetails?: any; paidAmount?: number; balance?: number }): Promise<CheckoutResponse> {
    const storeId = getStoreId() || 1;
    const orgId = getOrganizationId() || 1;

    // 1. Load setting
    const reqSetting1 = await settingsRepository.get("require_customer_before_checkout", "0");
    const reqSetting2 = await settingsRepository.get("require_customer", "0");
    const requireCustomer = reqSetting1 === "1" || reqSetting1 === "true" || reqSetting2 === "1" || reqSetting2 === "true";
    const walkInEnabled = !requireCustomer;

    let phone = request.customerPhone;
    let name = request.customerName;
    let customerId = request.customerId;

    // Sanitize phone number (strip non-digits, leading zeros, +91 prefix)
    let sanitizedPhone = (phone || "").replace(/\D/g, "");
    if (sanitizedPhone.length === 12 && sanitizedPhone.startsWith("91")) {
      sanitizedPhone = sanitizedPhone.slice(2);
    }
    if (sanitizedPhone.length === 11 && sanitizedPhone.startsWith("0")) {
      sanitizedPhone = sanitizedPhone.slice(1);
    }

    const isExplicitCustomer = Boolean(
      customerId ||
      (sanitizedPhone && sanitizedPhone !== "0000000000" && sanitizedPhone.length >= 10) ||
      (name && name.trim() !== "" && name.trim() !== "Walk-in Customer")
    );

    console.log("[Checkout Customer Validation]", {
      customerId,
      customerName: name,
      customerPhone: phone,
      requireCustomer,
      walkInEnabled,
      isExplicitCustomer
    });

    // 2. Validate mandatory customer selection if require_customer_before_checkout is enabled
    if (requireCustomer && !isExplicitCustomer) {
      throw new ValidationError("Please select a customer before completing checkout.");
    }

    const idempotencyKey = `${storeId}-${isExplicitCustomer ? (sanitizedPhone || customerId) : "walkin"}-${request.paymentMethod}-${request.items
      .map((i) => `${i.productId}:${i.quantity}`)
      .join(",")}`;

    const now = Date.now();
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached && now - cached.timestamp < 3000) {
      console.log("[Checkout Flow] Returning cached response for duplicate request:", idempotencyKey);
      return cached.response;
    }

    const t0 = performance.now();

    const result = await db.transaction(async (tx) => {
      // 3. Resolve customer
      const tCustomerStart = performance.now();
      let customer: any = null;

      if (isExplicitCustomer) {
        if (customerId) {
          customer = await customerRepository.getById(Number(customerId), tx);
        }
        if (!customer && sanitizedPhone && sanitizedPhone.length >= 10) {
          customer = await customerRepository.getByPhone(sanitizedPhone, true, tx);
        }
        if (!customer && name && name.trim() !== "" && name.trim() !== "Walk-in Customer") {
          const [found] = await tx
            .select()
            .from(customers)
            .where(and(eq(customers.name, name.trim()), eq(customers.store_id, storeId)))
            .limit(1);
          customer = found;
        }

        if (!customer) {
          const [newCust] = await tx
            .insert(customers)
            .values({
              organization_id: orgId,
              store_id: storeId,
              name: (name || "").trim() || `Customer - ${sanitizedPhone || "Guest"}`,
              phone: sanitizedPhone && sanitizedPhone.length >= 10 ? sanitizedPhone : null,
              email: null,
              address: null,
              notes: "Auto-created during checkout",
              total_orders: 0,
              lifetime_value: 0,
              is_active: 1,
            })
            .returning();
          customer = newCust;
        } else if (
          name &&
          name.trim() !== "" &&
          name.trim() !== "Walk-in Customer" &&
          (customer.name.startsWith("Customer - ") || customer.name === "Walk-in Customer")
        ) {
          const [updatedCust] = await tx
            .update(customers)
            .set({ name: name.trim(), updated_at: new Date() })
            .where(eq(customers.id, customer.id))
            .returning();
          customer = updatedCust;
        }
      }

      if (!customer) {
        customer = await customerRepository.ensureSystemWalkInCustomer(orgId, storeId, tx);
      }
      const tCustomerTime = performance.now() - tCustomerStart;

      // 2. Generate next sequential invoice number
      const tInvStart = performance.now();
      const invoiceNumber = await this.generateNextInvoiceNumber(storeId, tx);
      const tInvTime = performance.now() - tInvStart;
      console.log("[Checkout Flow] Invoice Created:", invoiceNumber);

      // 3. Process items, validate stock, and calculate totals
      const tStockStart = performance.now();
      let subtotal = 0;
      let totalGst = 0;
      const processedItems: any[] = [];
      const syncProductsList: any[] = [];

      const toISOStringSafe = (val: any): string | null => {
        if (!val) return null;
        if (val instanceof Date) return val.toISOString();
        if (typeof val === "string") {
          const d = new Date(val);
          return isNaN(d.getTime()) ? val : d.toISOString();
        }
        return null;
      };

      for (const item of request.items) {
        const movementResult = await this.movementService.recordSale(
          item.productId,
          storeId,
          item.quantity,
          invoiceNumber,
          request.cashierName || "System",
          "POS Sale Checkout",
          tx
        );
        const product = movementResult.product;

        syncProductsList.push({
          ...product,
          created_at: toISOStringSafe(product.created_at),
          updated_at: toISOStringSafe(product.updated_at)
        });

        // Calculations
        const itemDiscount = item.discount ?? 0;
        const lineTotal = item.quantity * product.selling_price - itemDiscount;
        const lineGst = Math.round((lineTotal * (product.gst ?? 18)) / 100);

        subtotal += item.quantity * product.selling_price;
        totalGst += lineGst;

        processedItems.push({
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          sellingPrice: product.selling_price,
          discount: itemDiscount,
          lineTotal: lineTotal + lineGst,
          lineGst: lineGst,
        });
      }
      const tStockTime = performance.now() - tStockStart;
      console.log("[Checkout Flow] Stock Updated");

      const discount = request.discount ?? 0;
      const grandTotal = subtotal + totalGst - discount;
      const paidAmount = request.paidAmount ?? grandTotal;
      const balance = request.balance ?? Math.max(0, grandTotal - paidAmount);

      const paymentDetailsJson = request.paymentDetails ? JSON.stringify(request.paymentDetails) : null;

      // 4. Create Sale entry
      const tSaleStart = performance.now();
      const crypto = require("crypto");
      const publicToken = crypto.randomBytes(9).toString("base64url").substring(0, 12);
      const [sale] = await tx
        .insert(sales)
        .values({
          organization_id: orgId,
          store_id: storeId,
          invoice_number: invoiceNumber,
          customer_id: customer.id,
          cashier_name: request.cashierName,
          payment_method: request.paymentMethod,
          payment_details: paymentDetailsJson,
          subtotal,
          discount,
          gst: totalGst,
          grand_total: grandTotal,
          paid_amount: paidAmount,
          balance: balance,
          public_token: publicToken,
          pdf_url: "",
        })
        .returning();

      console.log("[Checkout Flow] Sale Saved:", sale.id);

      // Add creation details to audit logs
      await tx.insert(audit_logs).values({
        organization_id: orgId,
        store_id: storeId,
        user_id: getUserId(),
        action: "INVOICE_CREATE",
        details: `${request.cashierName || "Admin"} created Invoice ${invoiceNumber}`,
      });
      const tSaleTime = performance.now() - tSaleStart;

      // 5. Create Sale Item records via atomic multi-row batch insert
      const tItemsStart = performance.now();
      if (processedItems.length > 0) {
        await tx.insert(sale_items).values(
          processedItems.map((item) => ({
            organization_id: orgId,
            store_id: storeId,
            sale_id: sale.id,
            product_id: item.productId,
            quantity: item.quantity,
            selling_price: item.sellingPrice,
            discount: item.discount,
            line_total: item.lineTotal,
          }))
        );
      }
      const tItemsTime = performance.now() - tItemsStart;

      // 6. Update Customer profile metrics
      const tCustUpdateStart = performance.now();
      const updatedOrders = (customer.total_orders ?? 0) + 1;
      const updatedLtv = (customer.lifetime_value ?? 0) + grandTotal;

      const [updatedCustomer] = await tx
        .update(customers)
        .set({
          total_orders: updatedOrders,
          lifetime_value: updatedLtv,
          last_visit: new Date(),
          updated_at: new Date(),
        })
        .where(eq(customers.id, customer.id))
        .returning();
      const tCustUpdateTime = performance.now() - tCustUpdateStart;

      console.log("[Checkout Flow] Receipt Generated");
      console.log("[Checkout Flow] Cloudinary Uploaded (N/A)");

      return {
        success: true,
        invoice: invoiceNumber,
        saleId: sale.id,
        subtotal,
        discount,
        gst: totalGst,
        grandTotal,
        publicToken,
        items: processedItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          lineTotal: item.lineTotal,
        })),
        syncCustomer: {
          ...updatedCustomer,
          created_at: toISOStringSafe(updatedCustomer.created_at),
          updated_at: toISOStringSafe(updatedCustomer.updated_at),
          last_visit: toISOStringSafe(updatedCustomer.last_visit)
        },
        syncProducts: syncProductsList,
        timings: {
          customerLookup: tCustomerTime.toFixed(2),
          invoiceGen: tInvTime.toFixed(2),
          inventoryDeduction: tStockTime.toFixed(2),
          saleInsert: tSaleTime.toFixed(2),
          itemsInsert: tItemsTime.toFixed(2),
          customerUpdate: tCustUpdateTime.toFixed(2),
          dbTransactionTotal: (performance.now() - t0).toFixed(2)
        }
      };
    });

    // Step 5 & 6: Immediate WhatsApp message preparation (failsafe - never rolls back or blocks checkout)
    let whatsappUrl: string | undefined = undefined;
    let whatsappPrepared = false;
    let whatsappError: string | undefined = undefined;

    try {
      const { ShareService } = require("./share.service");
      const { SalesService } = require("./sales.service");
      const shareService = new ShareService();
      const salesService = new SalesService();

      const receipt = await salesService.getReceipt(result.invoice);
      if (receipt) {
        const isSystemWalkIn = !isExplicitCustomer || receipt.customer?.name === "Walk-in Customer";
        const customerPhoneDigits = (receipt.customer?.phone || "").replace(/\D/g, "");
        const hasValidPhone = Boolean(customerPhoneDigits && customerPhoneDigits !== "0000000000" && customerPhoneDigits.length >= 10);

        if (isSystemWalkIn) {
          // System Walk-in Customer: Skip WhatsApp automatically, do not throw error or block checkout
          whatsappPrepared = false;
        } else if (hasValidPhone) {
          // Named customer with valid phone: Generate WhatsApp message immediately
          whatsappUrl = shareService.generateWhatsAppLink(receipt);
          whatsappPrepared = true;
        } else {
          // Named customer without phone: Checkout succeeds, return notification message
          whatsappPrepared = false;
          whatsappError = "Sale completed successfully. WhatsApp sharing unavailable because no phone number is available.";
        }
      }
    } catch (err: any) {
      console.error("[Checkout Flow] WhatsApp message preparation notice (checkout succeeded):", err.message || err);
      whatsappPrepared = false;
    }

    const finalResult: CheckoutResponse = {
      ...result,
      whatsappUrl,
      whatsappPrepared,
      ...(whatsappError ? { whatsappError } : {}),
    };

    // Enqueue background sync/notifications asynchronously outside response thread
    setImmediate(() => {
      try {
        const { SyncQueueManager } = require("./sync.service");
        
        // A. Sale Sync
        const syncPayload = {
          invoiceNumber: result.invoice,
          date: formatInTimeZone(new Date(), "Asia/Kolkata", "yyyy-MM-dd"),
          time: formatInTimeZone(new Date(), "Asia/Kolkata", "hh:mm a"),
          cashier: request.cashierName || "System",
          paymentMethod: request.paymentMethod,
          subtotal: result.subtotal / 100.0,
          discount: result.discount / 100.0,
          gst: result.gst / 100.0,
          grandTotal: result.grandTotal / 100.0,
          publicToken: result.publicToken
        };
        SyncQueueManager.getInstance().enqueue("sale", syncPayload);

        // B. Customer Sync
        if (result.syncCustomer) {
          SyncQueueManager.getInstance().enqueue("customer", result.syncCustomer);
        }

        // C. Products Sync
        if (result.syncProducts && Array.isArray(result.syncProducts)) {
          for (const prod of result.syncProducts) {
            SyncQueueManager.getInstance().enqueue("product", prod);
          }
        }
      } catch (e) {
        // safe ignore if manager is uninitialized
      }
    });

    idempotencyCache.set(idempotencyKey, { timestamp: Date.now(), response: finalResult });
    return finalResult;
  }
}
