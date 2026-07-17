import { saleRepository, customerRepository, settingsRepository } from "../repositories";
import { NotFoundError } from "../utils/errors";
import { Sale, SaleDetailResponse } from "../types/checkout.types";
import { formatToKolkataDate, formatToKolkataTime } from "../utils/datetime";
import QRCode from "qrcode";
import { db } from "../db";
import { sales, sale_items, products, customers, audit_logs, inventory_logs } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { SyncQueueManager } from "./sync.service";
import { InventoryMovementService } from "./inventory-movement.service";

export interface ReceiptResponse {
  invoiceNumber: string;
  date: string;
  time: string;
  shop: {
    name: string;
    gstin: string;
    phone: string;
    address: string;
    upiId: string;
    logo?: string;
  };
  customer: {
    name: string;
    phone: string;
  };
  items: {
    name: string;
    qty: number;
    price: number;
    discount: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  cashier: string;
  upiPayload: string;
  thankYouMessage: string;
  thermalFormat: any[];
  publicToken: string;
  pdfUrl: string;
  upiQrCode?: string;
  status?: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
}

export class SalesService {
  private saleRepo = saleRepository;
  private customerRepo = customerRepository;
  private movementService = new InventoryMovementService();

  async getAll(): Promise<Sale[]> {
    return this.saleRepo.getAll();
  }

  async getByCustomerPhone(phone: string): Promise<Sale[]> {
    return this.saleRepo.getByCustomerPhone(phone);
  }

  async getById(id: number): Promise<SaleDetailResponse> {
    const sale = await this.saleRepo.getById(id);
    if (!sale) {
      throw new NotFoundError(`Sale with ID ${id} not found`);
    }

    const customer = sale.customer_id ? await this.customerRepo.getById(sale.customer_id) : null;
    const items = await this.saleRepo.getSaleItems(sale.id);

    return {
      sale,
      customer,
      items,
      totals: {
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        grand_total: sale.grand_total,
      },
    };
  }

  async getByInvoice(invoice: string): Promise<SaleDetailResponse> {
    const sale = await this.saleRepo.getByInvoice(invoice);
    if (!sale) {
      throw new NotFoundError(`Sale with invoice number "${invoice}" not found`);
    }

    const customer = sale.customer_id ? await this.customerRepo.getById(sale.customer_id) : null;
    const items = await this.saleRepo.getSaleItems(sale.id);

    return {
      sale,
      customer,
      items,
      totals: {
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        grand_total: sale.grand_total,
      },
    };
  }

  async getTodaySales(): Promise<Sale[]> {
    return this.saleRepo.getTodaySales();
  }

  async getReceipt(idOrInvoice: string): Promise<ReceiptResponse> {
    let sale: Sale | null = null;

    const numericId = parseInt(idOrInvoice, 10);
    if (!isNaN(numericId) && String(numericId) === idOrInvoice) {
      sale = await this.saleRepo.getById(numericId);
    } else {
      sale = await this.saleRepo.getByInvoice(idOrInvoice);
    }

    if (!sale) {
      throw new NotFoundError(`Sale with identifier "${idOrInvoice}" not found`);
    }

    const customer = sale.customer_id ? await this.customerRepo.getById(sale.customer_id) : null;
    const items = await this.saleRepo.getSaleItems(sale.id);

    const shop = {
      name: await settingsRepository.get("shop_name", "Orion Store"),
      gstin: await settingsRepository.get("shop_gstin", "27AAAAA1111A1Z1"),
      phone: await settingsRepository.get("shop_phone", "8285068670"),
      address: await settingsRepository.get("shop_address", "123, POS Center, Sector V, Salt Lake, Kolkata, 700091"),
      upiId: await settingsRepository.get("shop_upi_id", "orion@upi"),
    };

    const formattedDate = formatToKolkataDate(sale.created_at);
    const formattedTime = formatToKolkataTime(sale.created_at);

    const itemsMapped = items.map((i) => ({
      productId: i.product_id,
      name: i.product_name,
      qty: i.quantity,
      price: i.selling_price / 100.0,
      discount: (i.discount || 0) / 100.0,
      lineTotal: i.line_total / 100.0,
      gst: i.product_gst ?? 18,
    }));

    const upiPayload = `upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.name)}&am=${(sale.grand_total / 100.0).toFixed(2)}&cu=INR`;
    const thankYouMessage = await settingsRepository.get("receipt_footer", "Thank you for shopping with us\n*** Thank you — visit again ***");

    // Generate UPI QR code offline
    let upiQrCode = "";
    if (sale.payment_method === "UPI") {
      try {
        upiQrCode = await QRCode.toDataURL(upiPayload);
      } catch (e) {
        console.error("Failed to generate UPI QR code:", e);
      }
    }

    // Create 58mm Thermal JSON Structure
    const thermalFormat = [
      { type: "text", value: shop.name, align: "center", bold: true },
      { type: "text", value: shop.address, align: "center" },
      { type: "text", value: `GSTIN: ${shop.gstin}`, align: "center" },
      { type: "text", value: `Phone: ${shop.phone}`, align: "center" },
      { type: "divider" },
      { type: "text", value: `Invoice: ${sale.invoice_number}` },
      { type: "text", value: `Date: ${formattedDate} ${formattedTime}` },
      { type: "text", value: `Cashier: ${sale.cashier_name || "Admin"}` },
      { type: "text", value: `Customer: ${customer ? customer.name : "Walk-in Customer"}` },
      { type: "divider" },
      ...itemsMapped.map((i) => ({
        type: "item",
        name: i.name,
        qty: i.qty,
        price: i.price,
        total: i.lineTotal
      })),
      { type: "divider" },
      { type: "text", value: `Subtotal: Rs ${(sale.subtotal / 100.0).toFixed(2)}`, align: "right" },
      { type: "text", value: `Discount: Rs ${(sale.discount / 100.0).toFixed(2)}`, align: "right" },
      { type: "text", value: `GST: Rs ${(sale.gst / 100.0).toFixed(2)}`, align: "right" },
      { type: "text", value: `Grand Total: Rs ${(sale.grand_total / 100.0).toFixed(2)}`, align: "right", bold: true },
      { type: "divider" },
      { type: "text", value: `Payment: ${sale.payment_method}`, align: "center" },
      { type: "text", value: thankYouMessage, align: "center", bold: true }
    ];

    return {
      invoiceNumber: sale.invoice_number,
      date: formattedDate,
      time: formattedTime,
      shop: {
        ...shop,
        logo: await settingsRepository.get("logo", "")
      },
      customer: {
        name: customer ? customer.name : "Walk-in Customer",
        phone: customer ? customer.phone : "",
      },
      items: itemsMapped,
      subtotal: sale.subtotal / 100.0,
      discount: sale.discount / 100.0,
      gst: sale.gst / 100.0,
      grandTotal: sale.grand_total / 100.0,
      paymentMethod: sale.payment_method,
      cashier: sale.cashier_name || "Admin",
      upiPayload,
      thankYouMessage,
      thermalFormat,
      publicToken: sale.public_token || "",
      pdfUrl: sale.pdf_url || "",
      upiQrCode,
      status: sale.status,
      voidReason: sale.void_reason ?? undefined,
      voidedBy: sale.voided_by ?? undefined,
      voidedAt: sale.voided_at ? sale.voided_at : undefined,
    };
  }

  async voidInvoice(saleId: number, reason: string, voidedBy: string, userId: number): Promise<any> {
    const result = await db.transaction(async (tx) => {
      // 1. Fetch sale with lock for update
      const [sale] = await tx
        .select()
        .from(sales)
        .where(eq(sales.id, saleId))
        .for("update");

      if (!sale) {
        throw new Error("Invoice not found");
      }

      if (sale.status === "VOID") {
        throw new Error("Invoice is already voided");
      }

      const storeId = sale.store_id;

      // 2. Fetch sale items
      const items = await tx
        .select()
        .from(sale_items)
        .where(eq(sale_items.sale_id, saleId));

      // 3. Restore inventory stock & log inventory movement
      const syncProductsList: any[] = [];
      for (const item of items) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, item.product_id), eq(products.store_id, storeId)))
          .for("update");

        if (product) {
          const movementResult = await this.movementService.recordVoidInvoice(
            product.id,
            storeId,
            item.quantity,
            sale.invoice_number,
            voidedBy,
            `Voided invoice: ${reason}`,
            tx
          );
          const updatedProduct = movementResult.product;
          syncProductsList.push(updatedProduct);
        }
      }

      // 4. Reverse customer orders & lifetime spend
      let updatedCustomer = null;
      if (sale.customer_id) {
        const [customer] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, sale.customer_id), eq(customers.store_id, storeId)))
          .for("update");

        if (customer && customer.phone !== "0000000000") {
          const [cust] = await tx
            .update(customers)
            .set({
              total_orders: Math.max(0, customer.total_orders - 1),
              lifetime_value: Math.max(0, customer.lifetime_value - sale.grand_total),
              updated_at: new Date(),
            })
            .where(eq(customers.id, customer.id))
            .returning();
          updatedCustomer = cust;
        }
      }

      // 5. Update status in sales table
      const [updatedSale] = await tx
        .update(sales)
        .set({
          status: "VOID",
          void_reason: reason,
          voided_by: voidedBy,
          voided_at: new Date(),
        })
        .where(eq(sales.id, saleId))
        .returning();

      // 6. Add to audit_logs
      await tx.insert(audit_logs).values({
        store_id: storeId,
        user_id: userId,
        action: "INVOICE_VOID",
        details: `${voidedBy} voided Invoice ${sale.invoice_number}. Reason: ${reason}`,
      });

      return {
        sale: updatedSale,
        customer: updatedCustomer,
        products: syncProductsList,
      };
    });

    // 7. Enqueue Google Sheets Sync jobs
    try {
      const syncEnabled = (await settingsRepository.get("google_sync_enabled", "0")) === "1";
      if (syncEnabled) {
        const formattedDate = formatToKolkataDate(result.sale.created_at);
        const formattedTime = formatToKolkataTime(result.sale.created_at);
        
        SyncQueueManager.getInstance().enqueue("sale", {
          invoiceNumber: result.sale.invoice_number,
          date: formattedDate,
          time: formattedTime,
          cashier: result.sale.cashier_name,
          paymentMethod: result.sale.payment_method,
          subtotal: result.sale.subtotal / 100.0,
          discount: result.sale.discount / 100.0,
          gst: result.sale.gst / 100.0,
          grandTotal: result.sale.grand_total / 100.0,
          publicToken: result.sale.public_token,
          status: "VOID",
          voidReason: reason,
          voidDate: formatToKolkataDate(result.sale.voided_at!),
          voidTime: formatToKolkataTime(result.sale.voided_at!),
          voidBy: voidedBy,
        });

        if (result.customer) {
          SyncQueueManager.getInstance().enqueue("customer", result.customer);
        }

        for (const prod of result.products) {
          SyncQueueManager.getInstance().enqueue("product", prod);
        }
      }
    } catch (e) {
      console.error("❌ Failed to enqueue Google Sheets sync jobs on invoice void:", e);
    }

    return result;
  }

  async logAudit(storeId: number, userId: number, action: string, details: string): Promise<void> {
    await db.insert(audit_logs).values({
      store_id: storeId,
      user_id: userId,
      action,
      details,
    });
  }
}
