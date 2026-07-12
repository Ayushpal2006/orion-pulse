import dbProxy from "../database";
import { checkoutRepository, productRepository, customerRepository, saleRepository } from "../repositories";
import { CheckoutRequest, CheckoutResponse } from "../types/checkout.types";
import { ValidationError, NotFoundError } from "../utils/errors";
import { getCurrentUtcString } from "../utils/datetime";
import { databaseConfig } from "../config/database";

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
  private checkoutRepo = checkoutRepository;
  private productRepo = productRepository;
  private customerRepo = customerRepository;
  private saleRepo = saleRepository;

  async executeCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const idempotencyKey = `${request.customerPhone}-${request.paymentMethod}-${request.items
      .map((i) => `${i.productId}:${i.quantity}`)
      .join(",")}`;

    const now = Date.now();
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached && now - cached.timestamp < 3000) {
      console.warn(`[IDEMPOTENCY] Duplicate checkout request detected for key: ${idempotencyKey}. Returning cached response.`);
      return cached.response;
    }

    const result = await dbProxy.transaction(async (tx) => {
      // 1. Find or create customer
      let customer = await this.customerRepo.getByPhone(request.customerPhone, false, tx);
      if (!customer) {
        customer = await this.customerRepo.create({
          name: request.customerName || `Customer - ${request.customerPhone}`,
          phone: request.customerPhone,
          email: null,
          address: null,
          notes: "Auto-created during checkout",
        }, tx);
        
        try {
          const { SyncQueueManager } = require("./sync.service");
          SyncQueueManager.getInstance().enqueue("customer", {
            phone: customer.phone,
            name: customer.name,
            email: customer.email,
            address: customer.address,
            total_orders: 0,
            lifetime_value: 0,
            last_visit: null
          });
        } catch (e) {
          console.error("Failed to enqueue initial customer sync:", e);
        }
      } else if (
        request.customerName &&
        request.customerName !== "Walk-in Customer" &&
        (customer.name.startsWith("Customer - ") || customer.name === "Walk-in Customer")
      ) {
        await this.customerRepo.update(customer.id, { name: request.customerName }, tx);
        customer.name = request.customerName;
      }

      // 2. Generate next sequential invoice number
      const lastInvoice = await this.saleRepo.getLastInvoiceNumber(tx);
      let nextNum = 1;
      if (lastInvoice) {
        const parts = lastInvoice.split("-");
        if (parts.length === 3) {
          const numPart = parseInt(parts[2], 10);
          if (!isNaN(numPart)) {
            nextNum = numPart + 1;
          }
        }
      }
      const invoiceNumber = `INV-2026-${String(nextNum).padStart(6, "0")}`;

      // 3. Process items, validate stock, and calculate totals
      let subtotal = 0;
      let totalGst = 0;
      const processedItems: any[] = [];

      for (const item of request.items) {
        if (databaseConfig.type === "postgres") {
          // Lock product row for update in Postgres
          await tx.execute("SELECT id FROM products WHERE id = $1 FOR UPDATE", [item.productId]);
        }
        const product = await this.productRepo.getById(item.productId, tx);
        if (!product || product.is_active === 0) {
          throw new NotFoundError(`Product with ID ${item.productId} not found or inactive`);
        }

        if (product.stock < item.quantity) {
          throw new ValidationError(
            `Product "${product.name}" is out of stock. Available: ${product.stock}, Requested: ${item.quantity}`
          );
        }

        const updatedStock = product.stock - item.quantity;
        const updatedProduct = await this.productRepo.update(product.id, { stock: updatedStock }, tx);
        if (updatedProduct) {
          try {
            const { SyncQueueManager } = require("./sync.service");
            SyncQueueManager.getInstance().enqueue("product", updatedProduct);
          } catch (e) {
            console.error("Failed to enqueue product sync on checkout:", e);
          }
        }

        const lineTotal = item.quantity * product.selling_price;
        const lineGst = Math.round((lineTotal * (product.gst ?? 18)) / 100);

        subtotal += lineTotal;
        totalGst += lineGst;

        processedItems.push({
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          sellingPrice: product.selling_price,
          lineTotal: lineTotal,
          lineGst: lineGst,
        });
      }

      const discount = 0;
      const grandTotal = subtotal + totalGst - discount;

      // 4. Create Sale entry
      const saleId = await this.checkoutRepo.createSale({
        invoice_number: invoiceNumber,
        customer_id: customer.id,
        cashier_name: request.cashierName,
        payment_method: request.paymentMethod,
        subtotal,
        discount,
        gst: totalGst,
        grand_total: grandTotal,
      }, tx);

      // 5. Create Sale Item records
      for (const item of processedItems) {
        await this.checkoutRepo.createSaleItem({
          sale_id: saleId,
          product_id: item.productId,
          quantity: item.quantity,
          selling_price: item.sellingPrice,
          discount: 0,
          line_total: item.lineTotal,
        }, tx);
      }

      // 6. Update Customer profile metrics
      const updatedOrders = (customer.total_orders ?? 0) + 1;
      const updatedLtv = (customer.lifetime_value ?? 0) + grandTotal;
      const lastVisitTime = getCurrentUtcString();

      await this.customerRepo.update(customer.id, {
        total_orders: updatedOrders,
        lifetime_value: updatedLtv,
        last_visit: lastVisitTime,
      }, tx);

      try {
        const { SyncQueueManager } = require("./sync.service");
        SyncQueueManager.getInstance().enqueue("customer", {
          phone: customer.phone,
          name: customer.name,
          email: customer.email,
          address: customer.address,
          total_orders: updatedOrders,
          lifetime_value: updatedLtv,
          last_visit: lastVisitTime
        });
      } catch (e) {
        console.error("Failed to enqueue customer sync on checkout:", e);
      }

      return {
        success: true,
        invoice: invoiceNumber,
        saleId,
        subtotal,
        discount,
        gst: totalGst,
        grandTotal,
        items: processedItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          lineTotal: item.lineTotal,
        })),
      };
    });

    // Asynchronously enqueue Google Sync background job
    try {
      const { SalesService } = require("./sales.service");
      const salesService = new SalesService();
      salesService.getReceipt(result.invoice).then((receipt: any) => {
        const { SyncQueueManager } = require("./sync.service");
        SyncQueueManager.getInstance().enqueue("sale", receipt);
      }).catch((e: any) => console.error("Sync getReceipt fail:", e));
    } catch (e) {
      console.error("Failed to enqueue sync job for sale:", e);
    }

    idempotencyCache.set(idempotencyKey, { timestamp: Date.now(), response: result });
    return result;
  }
}
