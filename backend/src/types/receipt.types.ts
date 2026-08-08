export interface BrandingConfig {
  shopName: string;
  gstin: string;
  phone: string;
  address: string;
  email: string;
  upiId: string;
  logo: string;
  receiptHeader: string;
  receiptFooter: string;
  termsAndConditions: string;
  signature: string;
  primaryColor: string;
  receiptTemplate: string;
  pdfTemplate: string;
  qrPosition: string;
}

export interface StoreConfig {
  storeId: number;
  organizationId: number;
  storeName: string;
  storeCode?: string;
  currency: string;
}

export interface ReceiptItemDTO {
  productId: number;
  name: string;
  qty: number;
  price: number;
  discount: number;
  lineTotal: number;
  gst: number;
}

export interface ThermalFormatItem {
  type: string;
  value?: string;
  align?: string;
  bold?: boolean;
}

export interface ReceiptDTO {
  invoiceNumber: string;
  date: string;
  time: string;
  branding: BrandingConfig;
  store: StoreConfig;
  customer: {
    id?: number;
    name: string;
    phone: string;
    address?: string;
  };
  items: ReceiptItemDTO[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  cashier: string;
  publicToken: string;
  pdfUrl: string;
  upiPayload: string;
  upiQrCode?: string;
  thermalFormat: ThermalFormatItem[];
  status?: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;

  // Backward-compatibility properties for existing components
  shop: {
    storeId: number;
    organizationId: number;
    name: string;
    gstin: string;
    phone: string;
    address: string;
    email: string;
    upiId: string;
    logo?: string;
  };
  signature?: string;
  pdfTemplate?: string;
  termsAndConditions?: string;
}
