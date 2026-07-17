import { db } from "../db";
import { sales, sale_items, products, customers, inventory_logs, audit_logs } from "../db/schema";
import { eq, and, desc, like } from "drizzle-orm";
import { CheckoutRequest, CheckoutResponse } from "../types/checkout.types";
import { ValidationError, NotFoundError } from "../utils/errors";
import { getStoreId, getUserId } from "../db/context";
import { getKolkataDateString } from "../utils/datetime";
import { formatInTimeZone } from "date-fns-tz";
import { settingsRepository } from "../repositories";
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
    const prefix = `INV-${todayStr}-`;

    const rows = await client
      .select({ invoice_number: sales.invoice_number })
      .from(sales)
      .where(and(eq(sales.store_id, storeId), like(sales.invoice_number, `${prefix}%`)))
      .orderBy(desc(sales.id))
      .limit(1);

    let nextSeq = 1;
    if (rows[0]) {
      const parts = rows[0].invoice_number.split("-");
      if (parts.length === 3) {
        const seqNum = parseInt(parts[2], 10);
        if (!isNaN(seqNum)) {
          nextSeq = seqNum + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, "0")}`;
  }

  async executeCheckout(request: CheckoutRequest & { paymentDetails?: any; paidAmount?: number; balance?: number }): Promise<CheckoutResponse> {
    const storeId = getStoreId() || 1;

    const requireCustomerSetting = await settingsRepository.get("require_customer_before_checkout", "0");
    const requireCustomer = requireCustomerSetting === "1";

    let phone = request.customerPhone;
    let name = request.customerName;

    if (requireCustomer) {
      if (!phone || phone.trim() === "" || phone === "0000000000" || name === "Walk-in Customer") {
        throw new ValidationError("Please select a customer before completing this sale.");
      }
    } else {
      if (!phone || phone.trim() === "" || phone === "0000000000") {
        phone = "0000000000";
        name = "Walk-in Customer";
      }
    }

    const idempotencyKey = `${storeId}-${phone}-${request.paymentMethod}-${request.items
      .map((i) => `${i.productId}:${i.quantity}`)
      .join(",")}`;

    const now = Date.now();
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached && now - cached.timestamp < 3000) {
      console.warn(`[IDEMPOTENCY] Duplicate checkout request detected for key: ${idempotencyKey}. Returning cached response.`);
      return cached.response;
    }

    const result = await db.transaction(async (tx) => {
      // 1. Find or create customer
      let [customer] = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.phone, phone), eq(customers.store_id, storeId)))
        .limit(1);

      if (!customer) {
        const [newCust] = await tx
          .insert(customers)
          .values({
            store_id: storeId,
            name: name || `Customer - ${phone}`,
            phone: phone,
            email: null,
            address: null,
            notes: phone === "0000000000" ? "System Walk-in Customer" : "Auto-created during checkout",
            total_orders: 0,
            lifetime_value: 0,
            is_active: 1,
          })
          .returning();
        customer = newCust;
      } else if (
        name &&
        name !== "Walk-in Customer" &&
        (customer.name.startsWith("Customer - ") || customer.name === "Walk-in Customer")
      ) {
        const [updatedCust] = await tx
          .update(customers)
          .set({ name: name, updated_at: new Date() })
          .where(eq(customers.id, customer.id))
          .returning();
        customer = updatedCust;
      }

      // 2. Generate next sequential invoice number
      const invoiceNumber = await this.generateNextInvoiceNumber(storeId, tx);

      // 3. Process items, validate stock, and calculate totals
      let subtotal = 0;
      let totalGst = 0;
      const processedItems: any[] = [];
      const syncProductsList: any[] = [];

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
          created_at: product.created_at.toISOString(),
          updated_at: product.updated_at.toISOString()
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

      const discount = request.discount ?? 0;
      const grandTotal = subtotal + totalGst - discount;
      const paidAmount = request.paidAmount ?? grandTotal;
      const balance = request.balance ?? Math.max(0, grandTotal - paidAmount);

      const paymentDetailsJson = request.paymentDetails ? JSON.stringify(request.paymentDetails) : null;

      // 4. Create Sale entry
      const crypto = require("crypto");
      const publicToken = crypto.randomBytes(9).toString("base64url").substring(0, 12);
      const [sale] = await tx
        .insert(sales)
        .values({
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

      // Add creation details to audit logs
      await tx.insert(audit_logs).values({
        store_id: storeId,
        user_id: getUserId(),
        action: "INVOICE_CREATE",
        details: `${request.cashierName || "Admin"} created Invoice ${invoiceNumber}`,
      });

      // 5. Create Sale Item records
      for (const item of processedItems) {
        await tx.insert(sale_items).values({
          sale_id: sale.id,
          product_id: item.productId,
          quantity: item.quantity,
          selling_price: item.sellingPrice,
          discount: item.discount,
          line_total: item.lineTotal,
        });
      }

      // 6. Update Customer profile metrics
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
          created_at: updatedCustomer.created_at.toISOString(),
          updated_at: updatedCustomer.updated_at.toISOString(),
          last_visit: updatedCustomer.last_visit ? updatedCustomer.last_visit.toISOString() : null
        },
        syncProducts: syncProductsList,
      };
    });

    // Enqueue background sync/notifications without blocking
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

    idempotencyCache.set(idempotencyKey, { timestamp: Date.now(), response: result });
    return result;
  }
}
