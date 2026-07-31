// Receipt Template & Customization System for Apka Bill V2

export type TemplatePreset =
  | "Classic"
  | "Modern"
  | "Minimal"
  | "Retail"
  | "Wholesale"
  | "GST Professional"
  | "Restaurant"
  | "Medical"
  | "Fashion"
  | "Compact"
  | "Thermal";

export interface ReceiptTemplateConfig {
  id: string;
  name: string;
  preset: TemplatePreset;
  paperWidth: "58mm" | "80mm" | "A4";
  charsPerLine: number;
  fontSize: "sm" | "base" | "lg";
  dividerStyle: "dashed" | "solid" | "double";
  
  header: {
    showLogo: boolean;
    logoPosition: "center" | "left" | "right";
    showBusinessName: boolean;
    showStoreName: boolean;
    showGstin: boolean;
    showFssai: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showWebsite: boolean;
    showInvoiceNumber: boolean;
    showDate: boolean;
    showTime: boolean;
    showCashier: boolean;
    showOrgName: boolean;
  };

  body: {
    showSku: boolean;
    showVariant: boolean;
    showNotes: boolean;
    showItemDiscount: boolean;
    showItemTax: boolean;
    showItemBarcode: boolean;
  };

  summary: {
    showSubtotal: boolean;
    showDiscount: boolean;
    showCgstSgst: boolean;
    showIgst: boolean;
    showRoundOff: boolean;
    showPaymentMethod: boolean;
    showAmountPaid: boolean;
    showBalance: boolean;
  };

  footer: {
    thankYouMessage: string;
    termsText: string;
    exchangePolicy: string;
    returnPolicy: string;
    showQrCode: boolean;
    showBarcode: boolean;
    showSignature: boolean;
    showPoweredBy: boolean;
    customFooter: string;
  };
}

export const DEFAULT_RECEIPT_TEMPLATES: Record<TemplatePreset, ReceiptTemplateConfig> = {
  Classic: {
    id: "tpl_classic",
    name: "Classic Thermal",
    preset: "Classic",
    paperWidth: "80mm",
    charsPerLine: 48,
    fontSize: "base",
    dividerStyle: "dashed",
    header: { showLogo: true, logoPosition: "center", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: false, showAddress: true, showPhone: true, showEmail: false, showWebsite: false, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: false },
    body: { showSku: false, showVariant: false, showNotes: false, showItemDiscount: true, showItemTax: true, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: false, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: true },
    footer: { thankYouMessage: "Thank you for shopping with us!", termsText: "Goods once sold will not be taken back.", exchangePolicy: "Exchange within 7 days with bill.", returnPolicy: "", showQrCode: true, showBarcode: true, showSignature: false, showPoweredBy: true, customFooter: "" },
  },
  Modern: {
    id: "tpl_modern",
    name: "Modern Banner",
    preset: "Modern",
    paperWidth: "80mm",
    charsPerLine: 48,
    fontSize: "base",
    dividerStyle: "solid",
    header: { showLogo: true, logoPosition: "center", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: true, showAddress: true, showPhone: true, showEmail: true, showWebsite: true, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: true },
    body: { showSku: true, showVariant: true, showNotes: true, showItemDiscount: true, showItemTax: true, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: true, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: true },
    footer: { thankYouMessage: "Thank you for your visit!", termsText: "Please keep this invoice for warranty & support.", exchangePolicy: "7-day seamless replacement guarantee.", returnPolicy: "", showQrCode: true, showBarcode: true, showSignature: true, showPoweredBy: true, customFooter: "Visit us at apkabill.in" },
  },
  Minimal: {
    id: "tpl_minimal",
    name: "Clean Minimal",
    preset: "Minimal",
    paperWidth: "80mm",
    charsPerLine: 48,
    fontSize: "sm",
    dividerStyle: "dashed",
    header: { showLogo: false, logoPosition: "center", showBusinessName: true, showStoreName: false, showGstin: true, showFssai: false, showAddress: true, showPhone: true, showEmail: false, showWebsite: false, showInvoiceNumber: true, showDate: true, showTime: false, showCashier: false, showOrgName: false },
    body: { showSku: false, showVariant: false, showNotes: false, showItemDiscount: false, showItemTax: false, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: false, showIgst: false, showRoundOff: true, showPaymentMethod: true, showAmountPaid: false, showBalance: false },
    footer: { thankYouMessage: "Thank You!", termsText: "", exchangePolicy: "", returnPolicy: "", showQrCode: true, showBarcode: false, showSignature: false, showPoweredBy: false, customFooter: "" },
  },
  Retail: {
    id: "tpl_retail",
    name: "Supermarket Retail",
    preset: "Retail",
    paperWidth: "80mm",
    charsPerLine: 48,
    fontSize: "base",
    dividerStyle: "double",
    header: { showLogo: true, logoPosition: "center", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: true, showAddress: true, showPhone: true, showEmail: false, showWebsite: false, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: false },
    body: { showSku: true, showVariant: false, showNotes: false, showItemDiscount: true, showItemTax: true, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: false, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: true },
    footer: { thankYouMessage: "Save Big Every Day!", termsText: "Offers valid till stocks last.", exchangePolicy: "No return on perishable grocery items.", returnPolicy: "", showQrCode: true, showBarcode: true, showSignature: false, showPoweredBy: true, customFooter: "" },
  },
  Wholesale: {
    id: "tpl_wholesale",
    name: "Wholesale Bulk",
    preset: "Wholesale",
    paperWidth: "A4",
    charsPerLine: 80,
    fontSize: "base",
    dividerStyle: "solid",
    header: { showLogo: true, logoPosition: "left", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: false, showAddress: true, showPhone: true, showEmail: true, showWebsite: true, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: true },
    body: { showSku: true, showVariant: true, showNotes: true, showItemDiscount: true, showItemTax: true, showItemBarcode: true },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: true, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: true },
    footer: { thankYouMessage: "Thank you for doing business with us!", termsText: "Interest @ 18% per annum will be charged on overdue payments.", exchangePolicy: "", returnPolicy: "", showQrCode: true, showBarcode: true, showSignature: true, showPoweredBy: true, customFooter: "Authorized Signatory" },
  },
  "GST Professional": {
    id: "tpl_gst_pro",
    name: "GST B2B Professional",
    preset: "GST Professional",
    paperWidth: "A4",
    charsPerLine: 80,
    fontSize: "base",
    dividerStyle: "solid",
    header: { showLogo: true, logoPosition: "left", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: true, showAddress: true, showPhone: true, showEmail: true, showWebsite: true, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: true },
    body: { showSku: true, showVariant: true, showNotes: true, showItemDiscount: true, showItemTax: true, showItemBarcode: true },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: true, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: true },
    footer: { thankYouMessage: "Tax Invoice Issued Under GST Rules", termsText: "Subject to Delhi Jurisdiction.", exchangePolicy: "", returnPolicy: "", showQrCode: true, showBarcode: true, showSignature: true, showPoweredBy: true, customFooter: "" },
  },
  Restaurant: {
    id: "tpl_restaurant",
    name: "Restaurant KOT / Bill",
    preset: "Restaurant",
    paperWidth: "80mm",
    charsPerLine: 48,
    fontSize: "base",
    dividerStyle: "dashed",
    header: { showLogo: true, logoPosition: "center", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: true, showAddress: true, showPhone: true, showEmail: false, showWebsite: false, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: false },
    body: { showSku: false, showVariant: true, showNotes: true, showItemDiscount: true, showItemTax: true, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: false, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: false },
    footer: { thankYouMessage: "Bon Appétit! Visit Us Again!", termsText: "5% Service Charge Included.", exchangePolicy: "", returnPolicy: "", showQrCode: true, showBarcode: false, showSignature: false, showPoweredBy: true, customFooter: "" },
  },
  Medical: {
    id: "tpl_medical",
    name: "Pharmacy & Medical",
    preset: "Medical",
    paperWidth: "80mm",
    charsPerLine: 48,
    fontSize: "base",
    dividerStyle: "solid",
    header: { showLogo: true, logoPosition: "center", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: true, showAddress: true, showPhone: true, showEmail: false, showWebsite: false, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: false },
    body: { showSku: true, showVariant: true, showNotes: true, showItemDiscount: true, showItemTax: true, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: false, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: true },
    footer: { thankYouMessage: "Get Well Soon!", termsText: "Drug License No: DL-12345/67890. Keep out of reach of children.", exchangePolicy: "Medicines once sold returned only with doctor prescription.", returnPolicy: "", showQrCode: true, showBarcode: true, showSignature: true, showPoweredBy: true, customFooter: "" },
  },
  Fashion: {
    id: "tpl_fashion",
    name: "Boutique & Apparel",
    preset: "Fashion",
    paperWidth: "80mm",
    charsPerLine: 48,
    fontSize: "base",
    dividerStyle: "dashed",
    header: { showLogo: true, logoPosition: "center", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: false, showAddress: true, showPhone: true, showEmail: true, showWebsite: true, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: false },
    body: { showSku: true, showVariant: true, showNotes: false, showItemDiscount: true, showItemTax: true, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: false, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: true },
    footer: { thankYouMessage: "Wear Your Style!", termsText: "No exchange without original price tag and bill.", exchangePolicy: "7-day exchange window.", returnPolicy: "", showQrCode: true, showBarcode: true, showSignature: false, showPoweredBy: true, customFooter: "Follow us @apkabill" },
  },
  Compact: {
    id: "tpl_compact",
    name: "58mm Mini Compact",
    preset: "Compact",
    paperWidth: "58mm",
    charsPerLine: 32,
    fontSize: "sm",
    dividerStyle: "dashed",
    header: { showLogo: false, logoPosition: "center", showBusinessName: true, showStoreName: false, showGstin: true, showFssai: false, showAddress: true, showPhone: true, showEmail: false, showWebsite: false, showInvoiceNumber: true, showDate: true, showTime: false, showCashier: true, showOrgName: false },
    body: { showSku: false, showVariant: false, showNotes: false, showItemDiscount: false, showItemTax: false, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: false, showIgst: false, showRoundOff: true, showPaymentMethod: true, showAmountPaid: false, showBalance: false },
    footer: { thankYouMessage: "Thanks!", termsText: "", exchangePolicy: "", returnPolicy: "", showQrCode: true, showBarcode: false, showSignature: false, showPoweredBy: false, customFooter: "" },
  },
  Thermal: {
    id: "tpl_thermal",
    name: "Standard ESC/POS Thermal",
    preset: "Thermal",
    paperWidth: "80mm",
    charsPerLine: 48,
    fontSize: "base",
    dividerStyle: "dashed",
    header: { showLogo: true, logoPosition: "center", showBusinessName: true, showStoreName: true, showGstin: true, showFssai: false, showAddress: true, showPhone: true, showEmail: false, showWebsite: false, showInvoiceNumber: true, showDate: true, showTime: true, showCashier: true, showOrgName: false },
    body: { showSku: false, showVariant: false, showNotes: false, showItemDiscount: true, showItemTax: true, showItemBarcode: false },
    summary: { showSubtotal: true, showDiscount: true, showCgstSgst: true, showIgst: false, showRoundOff: true, showPaymentMethod: true, showAmountPaid: true, showBalance: true },
    footer: { thankYouMessage: "Thank you for shopping with us!", termsText: "", exchangePolicy: "", returnPolicy: "", showQrCode: true, showBarcode: true, showSignature: false, showPoweredBy: true, customFooter: "" },
  },
};

const ACTIVE_TEMPLATE_KEY = "orion_pos_active_receipt_template";

export function getActiveTemplateConfig(): ReceiptTemplateConfig {
  if (typeof window === "undefined") return DEFAULT_RECEIPT_TEMPLATES.Classic;
  try {
    const raw = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const presetKey = (parsed.preset || "Classic") as TemplatePreset;
      return { ...(DEFAULT_RECEIPT_TEMPLATES[presetKey] || DEFAULT_RECEIPT_TEMPLATES.Classic), ...parsed };
    }
  } catch {
    // fallback
  }
  return DEFAULT_RECEIPT_TEMPLATES.Classic;
}

export function saveActiveTemplateConfig(config: ReceiptTemplateConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn("Failed to persist receipt template config:", err);
  }
}
