import db from "../database/db";
import { CheckoutRepository } from "../repositories/checkout.repository";
import { ProductRepository } from "../repositories/product.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { CheckoutRequest, CheckoutResponse } from "../types/checkout.types";
import { ValidationError, NotFoundError } from "./product.service";
import { getCurrentUtcString } from "../utils/datetime";

export class CheckoutService {
  private checkoutRepo: CheckoutRepository;
  private productRepo: ProductRepository;
  private customerRepo: CustomerRepository;

  constructor() {
    this.checkoutRepo = new CheckoutRepository();
    this.productRepo = new ProductRepository();
    this.customerRepo = new CustomerRepository();
  }

  async executeCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    // We execute the checkout logic inside db.transaction wrapper.
    // If any error is thrown, the transaction rolls back, and the error propagates to the caller.
    const checkoutTx = db.transaction((req: CheckoutRequest): CheckoutResponse => {
      // 1. Find or create customer
      let customer = this.customerRepo.getByPhone(req.customerPhone);
      if (!customer) {
        customer = this.customerRepo.create({
          name: req.customerName || `Customer - ${req.customerPhone}`,
          phone: req.customerPhone,
          email: null,
          address: null,
          notes: "Auto-created during checkout",
        });
      } else if (req.customerName && req.customerName !== "Walk-in Customer" && (customer.name.startsWith("Customer - ") || customer.name === "Walk-in Customer")) {
        // If the customer already exists but has the template/generic name, update it with their real name!
        this.customerRepo.update(customer.id, { name: req.customerName });
        customer.name = req.customerName; // update local object reference
      }

      // 2. Generate next sequential invoice number (e.g. INV-2026-000001)
      const lastSaleStmt = db.prepare("SELECT invoice_number FROM sales ORDER BY id DESC LIMIT 1");
      const lastSale = lastSaleStmt.get() as { invoice_number: string } | undefined;
      
      let nextNum = 1;
      if (lastSale) {
        const parts = lastSale.invoice_number.split("-");
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

      for (const item of req.items) {
        const product = this.productRepo.getById(item.productId);
        if (!product || product.is_active === 0) {
          throw new NotFoundError(`Product with ID ${item.productId} not found or inactive`);
        }

        if (product.stock < item.quantity) {
          throw new ValidationError(
            `Product "${product.name}" is out of stock. Available: ${product.stock}, Requested: ${item.quantity}`
          );
        }

        // Reduce stock in the DB
        const updatedStock = product.stock - item.quantity;
        const updatedProduct = this.productRepo.update(product.id, { stock: updatedStock });
        if (updatedProduct) {
          try {
            const { SyncQueueManager } = require("./sync.service");
            SyncQueueManager.getInstance().enqueue("product", updatedProduct);
          } catch (e) {
            console.error("Failed to enqueue product sync on checkout:", e);
          }
        }

        // Calculate pricing
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

      const discount = 0; // Default discount is 0
      const grandTotal = subtotal + totalGst - discount;

      // 4. Create Sale entry
      const saleId = this.checkoutRepo.createSale({
        invoice_number: invoiceNumber,
        customer_id: customer.id,
        cashier_name: req.cashierName,
        payment_method: req.paymentMethod,
        subtotal,
        discount,
        gst: totalGst,
        grand_total: grandTotal,
      });

      // 5. Create Sale Item records
      for (const item of processedItems) {
        this.checkoutRepo.createSaleItem({
          sale_id: saleId,
          product_id: item.productId,
          quantity: item.quantity,
          selling_price: item.sellingPrice,
          discount: 0,
          line_total: item.lineTotal,
        });
      }

      // 6. Update Customer profile metrics
      const updatedOrders = (customer.total_orders ?? 0) + 1;
      const updatedLtv = (customer.lifetime_value ?? 0) + grandTotal;
      // Store timestamps in UTC for consistent reporting and customer timelines.
      const lastVisitTime = getCurrentUtcString();

      this.customerRepo.update(customer.id, {
        total_orders: updatedOrders,
        lifetime_value: updatedLtv,
        last_visit: lastVisitTime,
      });

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

    // Run transaction block
    const result = checkoutTx(request);

    // Asynchronously enqueue Google Sync background job (do not block client checkout)
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

    return result;
  }
}
