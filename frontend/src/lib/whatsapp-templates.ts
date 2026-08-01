export interface WhatsAppTemplateConfig {
  id: string;
  name: string;
  badge?: string;
  description: string;
  defaultTemplate: string;
  sampleData: Record<string, string>;
}

export const WHATSAPP_TEMPLATES_REGISTRY: WhatsAppTemplateConfig[] = [
  {
    id: "sales_invoice",
    name: "Sales Invoice",
    badge: "Core",
    description: "Sent to customers after checkout",
    defaultTemplate: `Namaste {customer_name} 🙏\n\nYour invoice {invoice_number} for ₹{amount} is ready.\nDate: {date}\nStore: {shop_name}\n\nView Invoice: {invoice_link}\nPayment Link: {payment_link}\n\nThank you for shopping with us!`,
    sampleData: {
      "{customer_name}": "Rahul Sharma",
      "{supplier_name}": "N/A",
      "{shop_name}": "Orion POS Main Store",
      "{invoice_number}": "INV-00124",
      "{purchase_number}": "N/A",
      "{quotation_number}": "N/A",
      "{amount}": "2,450.00",
      "{balance_due}": "0.00",
      "{date}": "01 Aug 2026",
      "{invoice_link}": "https://apkabill.in/v/INV-00124",
      "{payment_link}": "https://apkabill.in/pay/INV-00124",
    },
  },
  {
    id: "purchase_order",
    name: "Purchase Order",
    badge: "Core",
    description: "Sent to suppliers for restocking orders",
    defaultTemplate: `Namaste {supplier_name} 🙏\n\nPurchase Order: {purchase_number}\nTotal Amount: ₹{amount}\nDate: {date}\nStore: {shop_name}\n\nThank you for your business!`,
    sampleData: {
      "{customer_name}": "N/A",
      "{supplier_name}": "Apex Electronics Supplies",
      "{shop_name}": "Orion POS Main Store",
      "{invoice_number}": "N/A",
      "{purchase_number}": "PO-PRCH-2026-0001",
      "{quotation_number}": "N/A",
      "{amount}": "12,800.00",
      "{balance_due}": "12,800.00",
      "{date}": "01 Aug 2026",
      "{invoice_link}": "https://apkabill.in/purchase/1",
      "{payment_link}": "N/A",
    },
  },
  {
    id: "payment_reminder",
    name: "Payment Reminder",
    badge: "Active",
    description: "Sent for overdue balances or pending payments",
    defaultTemplate: `Namaste {customer_name} 🙏\n\nThis is a friendly reminder that a balance of ₹{balance_due} is pending for Invoice {invoice_number}.\nDue Date: {date}\nStore: {shop_name}\n\nView & Pay: {invoice_link}\nPayment Link: {payment_link}\n\nThank you!`,
    sampleData: {
      "{customer_name}": "Vikram Malhotra",
      "{supplier_name}": "N/A",
      "{shop_name}": "Orion POS Main Store",
      "{invoice_number}": "INV-00098",
      "{purchase_number}": "N/A",
      "{quotation_number}": "N/A",
      "{amount}": "5,000.00",
      "{balance_due}": "1,500.00",
      "{date}": "01 Aug 2026",
      "{invoice_link}": "https://apkabill.in/v/INV-00098",
      "{payment_link}": "https://apkabill.in/pay/INV-00098",
    },
  },
  {
    id: "quotation",
    name: "Quotation",
    badge: "Future Ready",
    description: "Sent to customers for proforma estimates",
    defaultTemplate: `Namaste {customer_name} 🙏\n\nYour price estimate {quotation_number} for ₹{amount} has been generated.\nDate: {date}\nStore: {shop_name}\n\nView Quotation: {invoice_link}\n\nPlease reach out if you have any questions!`,
    sampleData: {
      "{customer_name}": "Ananya Roy",
      "{supplier_name}": "N/A",
      "{shop_name}": "Orion POS Main Store",
      "{invoice_number}": "N/A",
      "{purchase_number}": "N/A",
      "{quotation_number}": "QTN-2026-0089",
      "{amount}": "18,500.00",
      "{balance_due}": "0.00",
      "{date}": "01 Aug 2026",
      "{invoice_link}": "https://apkabill.in/quote/QTN-2026-0089",
      "{payment_link}": "N/A",
    },
  },
  {
    id: "expense_share",
    name: "Expense Share",
    badge: "Future Ready",
    description: "Sent to partners or accountants for logged business expenses",
    defaultTemplate: `Hello 👋\n\nBusiness Expense logged under {shop_name}.\nAmount: ₹{amount}\nDate: {date}\n\nDetails: {invoice_link}`,
    sampleData: {
      "{customer_name}": "N/A",
      "{supplier_name}": "Utility Provider",
      "{shop_name}": "Orion POS Main Store",
      "{invoice_number}": "EXP-9921",
      "{purchase_number}": "N/A",
      "{quotation_number}": "N/A",
      "{amount}": "3,200.00",
      "{balance_due}": "0.00",
      "{date}": "01 Aug 2026",
      "{invoice_link}": "https://apkabill.in/expenses/EXP-9921",
      "{payment_link}": "N/A",
    },
  },
];

/**
 * Resolves a dictionary of all supported placeholders using live record data and store context
 */
export function resolvePlaceholderValues(recordData?: any, storeInfo?: any, orgInfo?: any): Record<string, string> {
  const shopName = storeInfo?.name || storeInfo?.shop_name || orgInfo?.name || "Orion POS Main Store";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://apkabill.in";

  const customerName = recordData?.customerName || recordData?.customer_name || recordData?.customer?.name || recordData?.name || "Rahul Sharma";
  const supplierName = recordData?.supplierName || recordData?.supplier_name || recordData?.supplier?.name || "Apex Electronics Supplies";

  const invoiceNumber = recordData?.invoiceNumber || recordData?.invoice_number || recordData?.invoice || "INV-00124";
  const purchaseNumber = recordData?.purchaseNumber || recordData?.purchase_number || recordData?.po_number || recordData?.poNumber || "PO-PRCH-2026-0001";
  const quotationNumber = recordData?.quotationNumber || recordData?.quotation_number || recordData?.qtn_number || "QTN-2026-0089";

  const rawAmount = recordData?.total ?? recordData?.grandTotal ?? recordData?.amount ?? 2450;
  const amountStr = typeof rawAmount === "number" ? rawAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(rawAmount);

  const rawBalance = recordData?.balanceDue ?? recordData?.balance_due ?? recordData?.due_amount ?? 0;
  const balanceStr = typeof rawBalance === "number" ? rawBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(rawBalance);

  let dateStr = "01 Aug 2026";
  if (recordData?.date || recordData?.created_at) {
    try {
      dateStr = new Date(recordData.date || recordData.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      dateStr = String(recordData.date || recordData.created_at);
    }
  }

  const invoiceLink = recordData?.invoiceLink || recordData?.invoice_link || `${origin}/v/${invoiceNumber}`;
  const paymentLink = recordData?.paymentLink || recordData?.payment_link || `${origin}/pay/${invoiceNumber}`;

  return {
    customer_name: customerName,
    supplier_name: supplierName,
    shop_name: shopName,
    invoice_number: invoiceNumber,
    purchase_number: purchaseNumber,
    quotation_number: quotationNumber,
    amount: amountStr,
    balance_due: balanceStr,
    date: dateStr,
    invoice_link: invoiceLink,
    payment_link: paymentLink,
    "{customer_name}": customerName,
    "{supplier_name}": supplierName,
    "{shop_name}": shopName,
    "{invoice_number}": invoiceNumber,
    "{purchase_number}": purchaseNumber,
    "{quotation_number}": quotationNumber,
    "{amount}": amountStr,
    "{balance_due}": balanceStr,
    "{date}": dateStr,
    "{invoice_link}": invoiceLink,
    "{payment_link}": paymentLink,
  };
}

/** Render template with custom data. Safely replaces all placeholders without leaving raw {placeholder} tags. */
export function renderWhatsAppTemplate(templateText: string, data: Record<string, string>): string {
  if (!templateText) return "";
  let result = templateText;

  for (const [key, value] of Object.entries(data)) {
    const val = value ?? "";
    const cleanKey = key.replace(/^{|}$/g, "");
    result = result.replaceAll(`{${cleanKey}}`, val);
    result = result.replaceAll(cleanKey, val);
  }

  return result;
}
