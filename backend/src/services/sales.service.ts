import { SaleRepository } from "../repositories/sale.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { NotFoundError } from "./product.service";
import { Sale, SaleDetailResponse } from "../types/checkout.types";
import db from "../database/db";

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
}

export class SalesService {
  private saleRepo: SaleRepository;
  private customerRepo: CustomerRepository;

  constructor() {
    this.saleRepo = new SaleRepository();
    this.customerRepo = new CustomerRepository();
  }

  async getAll(): Promise<Sale[]> {
    return this.saleRepo.getAll();
  }

  async getByCustomerPhone(phone: string): Promise<Sale[]> {
    return this.saleRepo.getByCustomerPhone(phone);
  }

  async getById(id: number): Promise<SaleDetailResponse> {
    const sale = this.saleRepo.getById(id);
    if (!sale) {
      throw new NotFoundError(`Sale with ID ${id} not found`);
    }

    const customer = sale.customer_id ? this.customerRepo.getById(sale.customer_id) : null;
    const items = this.saleRepo.getSaleItems(sale.id);

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
    const sale = this.saleRepo.getByInvoice(invoice);
    if (!sale) {
      throw new NotFoundError(`Sale with invoice number "${invoice}" not found`);
    }

    const customer = sale.customer_id ? this.customerRepo.getById(sale.customer_id) : null;
    const items = this.saleRepo.getSaleItems(sale.id);

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

    // Check if numeric lookup or invoice lookup
    const numericId = parseInt(idOrInvoice, 10);
    if (!isNaN(numericId) && String(numericId) === idOrInvoice) {
      sale = this.saleRepo.getById(numericId);
    } else {
      sale = this.saleRepo.getByInvoice(idOrInvoice);
    }

    if (!sale) {
      throw new NotFoundError(`Sale with identifier "${idOrInvoice}" not found`);
    }

    const customer = sale.customer_id ? this.customerRepo.getById(sale.customer_id) : null;
    const items = this.saleRepo.getSaleItems(sale.id);

    // Query Settings Table
    const getSetting = (key: string, fallback: string): string => {
      try {
        const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
        const row = stmt.get(key) as { value: string } | undefined;
        return row ? row.value : fallback;
      } catch (e) {
        return fallback;
      }
    };

    const shop = {
      name: getSetting("shop_name", "Orion Store"),
      gstin: getSetting("shop_gstin", "27AAAAA1111A1Z1"),
      phone: getSetting("shop_phone", "8285068670"),
      address: getSetting("shop_address", "123, POS Center, Sector V, Salt Lake, Kolkata, 700091"),
      upiId: getSetting("shop_upi_id", "orion@upi"),
    };

    const saleDate = new Date(sale.created_at);
    const formattedDate = saleDate.toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric', timeZone: "Asia/Kolkata" });
    const formattedTime = saleDate.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: "Asia/Kolkata" });

    const itemsMapped = items.map((i) => ({
      name: i.product_name,
      qty: i.quantity,
      price: i.selling_price / 100.0,
      discount: (i.discount || 0) / 100.0,
      lineTotal: i.line_total / 100.0,
    }));

    const upiPayload = `upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.name)}&am=${(sale.grand_total / 100.0).toFixed(2)}&cu=INR`;
    const thankYouMessage = "Thank you for shopping at Orion Store!";

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
      shop,
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
    };
  }
}
