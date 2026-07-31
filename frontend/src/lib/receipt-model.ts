// Canonical Universal Receipt Data Model for Apka Bill V2

export interface ReceiptBusinessInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  logoUrl?: string;
}

export interface ReceiptStoreInfo {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  code?: string;
}

export interface ReceiptCustomerInfo {
  id?: number | string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyaltyPoints?: number;
}

export interface ReceiptItemModel {
  id: number | string;
  name: string;
  sku?: string;
  price: number;
  qty: number;
  discount?: number;
  tax?: number;
  total: number;
}

export interface ReceiptPaymentInfo {
  method: string;
  amountPaid: number;
  changeAmount: number;
  transactionId?: string;
}

export interface UniversalReceiptModel {
  id: string;
  invoiceNumber: string;
  date: string;
  time?: string;
  template: "Classic" | "Compact" | "Modern" | "Retail" | "Minimal";
  business: ReceiptBusinessInfo;
  store: ReceiptStoreInfo;
  cashierName: string;
  customer?: ReceiptCustomerInfo;
  items: ReceiptItemModel[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  payment: ReceiptPaymentInfo;
  qrCodeUrl?: string;
  barcodeData?: string;
  footerText?: string;
  metadata?: Record<string, any>;
}

export function createCanonicalReceiptModel(input: any): UniversalReceiptModel {
  const now = new Date();
  return {
    id: String(input.id || input.saleId || `REC-${Date.now()}`),
    invoiceNumber: input.invoiceNumber || input.invoice || `INV-${Date.now()}`,
    date: input.date || now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }),
    time: input.time || now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }),
    template: input.template || input.receipt_template || "Classic",
    business: {
      name: input.businessName || input.shopName || input.shop_name || "APKA BILL STORE",
      address: input.businessAddress || input.shopAddress || input.shop_address || "",
      phone: input.businessPhone || input.shopPhone || input.shop_phone || "",
      email: input.businessEmail || input.shopEmail || input.shop_email || "",
      gstin: input.businessGst || input.shopGst || input.shop_gstin || "",
      logoUrl: input.businessLogo || input.shop_logo || "",
    },
    store: {
      id: input.storeId || input.store_id || 1,
      name: input.storeName || input.store_name || "Main Store",
      address: input.storeAddress || "",
      phone: input.storePhone || "",
      code: input.storeCode || "",
    },
    cashierName: input.cashierName || input.cashier_name || "Admin",
    customer: {
      id: input.customerId || input.customer_id,
      name: input.customerName || input.customer_name || "Walk-In Customer",
      phone: input.customerPhone || input.customer_phone,
      email: input.customerEmail || input.customer_email,
      address: input.customerAddress || input.customer_address,
      loyaltyPoints: input.loyaltyPoints || input.loyalty_points || 0,
    },
    items: (input.items || []).map((i: any, idx: number) => ({
      id: i.id || i.product_id || idx + 1,
      name: i.name || i.product_name || `Item ${idx + 1}`,
      sku: i.sku || "",
      price: Number(i.price || i.unit_price || 0),
      qty: Number(i.qty || i.quantity || 1),
      discount: Number(i.discount || 0),
      tax: Number(i.tax || 0),
      total: Number(i.total || i.subtotal || (Number(i.price || 0) * Number(i.qty || 1))),
    })),
    subtotal: Number(input.subtotal || 0),
    discount: Number(input.discount || 0),
    tax: Number(input.tax || input.gst || 0),
    grandTotal: Number(input.grandTotal || input.total || input.total_amount || 0),
    payment: {
      method: input.paymentMethod || input.payment_method || "CASH",
      amountPaid: Number(input.amountPaid || input.amount_paid || input.total || 0),
      changeAmount: Number(input.changeAmount || input.change_amount || 0),
      transactionId: input.transactionId || input.transaction_id || "",
    },
    qrCodeUrl: input.qrCodeUrl || (input.invoiceNumber ? `https://apkabill.in/invoice/v/${input.invoiceNumber}` : ""),
    barcodeData: input.barcodeData || input.invoiceNumber || "",
    footerText: input.footerText || input.receiptFooter || input.receipt_footer || "Thank you for shopping with us!",
    metadata: input.metadata || {},
  };
}
