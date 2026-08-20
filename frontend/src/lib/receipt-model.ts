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
  
  const invNumber = input.invoiceNumber || (typeof input.invoice === "string" ? input.invoice : input.invoice?.invoiceNumber) || `INV-${Date.now()}`;
  const invDate = input.date || input.invoice?.date || now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" });
  const invTime = input.time || input.invoice?.time || now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  
  const shopName = input.branding?.shopName || input.shop?.name || input.businessName || input.shopName || input.shop_name || input.store?.name || "Store";
  const shopAddr = input.branding?.address || input.shop?.address || input.businessAddress || input.shopAddress || input.shop_address || input.store?.address || "";
  const shopPhone = input.branding?.phone || input.shop?.phone || input.businessPhone || input.shopPhone || input.shop_phone || input.store?.phone || "";
  const shopEmail = input.branding?.email || input.shop?.email || input.businessEmail || input.shopEmail || input.shop_email || "";
  const shopGst = input.branding?.gstin || input.shop?.gstin || input.businessGst || input.shopGst || input.shop_gstin || "";
  const shopLogo = input.branding?.logo || input.branding?.logoUrl || input.branding?.shopLogo || input.shop?.logo || input.shop?.logoUrl || input.businessLogo || input.shop_logo || input.logoUrl || input.logo || input.business?.logoUrl || input.store?.logo || input.store?.logo_url || "";

  const cashier = input.cashierName || input.cashier || input.invoice?.cashierName || input.cashier_name || "Admin";
  const subtotal = Number(input.subtotal ?? input.totals?.subtotal ?? 0);
  const discount = Number(input.discount ?? input.totals?.discount ?? 0);
  const tax = Number(input.tax ?? input.gst ?? input.totals?.tax ?? 0);
  const grandTotal = Number(input.grandTotal ?? input.total ?? input.total_amount ?? input.totals?.grandTotal ?? 0);

  const paymentMethod = input.paymentMethod || input.payment?.method || input.payment_method || "Cash";
  const amountPaid = Number(input.amountPaid || input.payment?.amountPaid || input.amount_paid || grandTotal);
  const changeAmount = Number(input.changeAmount || input.payment?.changeAmount || input.change_amount || 0);

  const upiPayload = input.qr?.upiPayload || input.upiPayload || input.qrCodeUrl || (invNumber ? `https://apkabill.in/invoice/v/${invNumber}` : "");
  const upiQrCode = input.qr?.upiQrCode || input.upiQrCode || input.metadata?.upiQrCode;

  const receiptTemplate = input.template || input.branding?.receiptTemplate || input.receipt_template || "Classic";
  const footerText = input.branding?.receiptFooter || input.thankYouMessage || input.footerText || input.footer?.thankYouMessage || input.receiptFooter || input.receipt_footer || "Thank you for shopping with us!";

  return {
    id: String(input.id || input.invoice?.id || input.saleId || `REC-${Date.now()}`),
    invoiceNumber: invNumber,
    date: invDate,
    time: invTime,
    template: receiptTemplate as any,
    business: {
      name: shopName,
      address: shopAddr,
      phone: shopPhone,
      email: shopEmail,
      gstin: shopGst,
      logoUrl: shopLogo,
    },
    store: {
      id: input.store?.id || input.store?.storeId || input.storeId || input.store_id || 1,
      name: input.store?.name || input.store?.storeName || input.storeName || shopName,
      address: input.store?.address || shopAddr,
      phone: input.store?.phone || shopPhone,
      code: input.store?.code || input.storeCode || "",
    },
    cashierName: cashier,
    customer: {
      id: input.customer?.id || input.customerId || input.customer_id,
      name: input.customer?.name || input.customerName || input.customer_name || "Walk-in Customer",
      phone: input.customer?.phone || input.customerPhone || input.customer_phone,
      email: input.customer?.email || input.customerEmail || input.customer_email,
      address: input.customer?.address || input.customerAddress || input.customer_address,
      loyaltyPoints: input.customer?.loyaltyPoints || input.loyaltyPoints || input.loyalty_points || 0,
    },
    items: (input.items || []).map((i: any, idx: number) => ({
      id: i.id || i.product_id || idx + 1,
      name: i.name || i.product_name || `Item ${idx + 1}`,
      sku: i.sku || "",
      price: Number(i.price ?? i.unit_price ?? i.sellingPrice ?? 0),
      qty: Number(i.qty ?? i.quantity ?? 1),
      discount: Number(i.discount ?? 0),
      tax: Number(i.tax ?? i.gst ?? 0),
      total: Number(i.total ?? i.lineTotal ?? i.line_total ?? (Number(i.price ?? i.sellingPrice ?? 0) * Number(i.qty ?? i.quantity ?? 1))),
    })),
    subtotal,
    discount,
    tax,
    grandTotal,
    payment: {
      method: paymentMethod,
      amountPaid,
      changeAmount,
      transactionId: input.transactionId || input.payment?.transactionId || input.transaction_id || "",
    },
    qrCodeUrl: upiPayload,
    barcodeData: input.barcodeData || invNumber,
    footerText,
    metadata: {
      ...(input.metadata || {}),
      upiQrCode,
      upiId: input.branding?.upiId || input.shop?.upiId || input.metadata?.upiId,
      primaryColor: input.branding?.primaryColor || input.primaryColor || input.metadata?.primaryColor,
      qrPosition: input.branding?.qrPosition || input.qrPosition || input.metadata?.qrPosition,
      paperWidth: input.branding?.paperWidth || input.paperWidth || input.metadata?.paperWidth,
    },
  };
}
