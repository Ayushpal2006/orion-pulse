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
    defaultTemplate: `Namaste {customer_name} 🙏\n\nYour invoice {invoice_number} for ₹{amount} is ready.\nDate: {date}\nStore: {shop_name}\n\nView Invoice: {invoice_link}\n\nThank you for shopping with us!`,
    sampleData: {
      "{customer_name}": "Rahul Sharma",
      "{supplier_name}": "N/A",
      "{shop_name}": "Orion POS Store",
      "{invoice_number}": "INV-00124",
      "{purchase_number}": "N/A",
      "{quotation_number}": "N/A",
      "{amount}": "2,450",
      "{balance_due}": "0",
      "{date}": "25 Jul 2026",
      "{invoice_link}": "https://orion.app/invoice/INV-00124",
      "{payment_link}": "https://orion.app/pay/INV-00124",
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
      "{shop_name}": "Orion POS Store",
      "{invoice_number}": "N/A",
      "{purchase_number}": "PO-PRCH-2026-0001",
      "{quotation_number}": "N/A",
      "{amount}": "12,800",
      "{balance_due}": "12,800",
      "{date}": "25 Jul 2026",
      "{invoice_link}": "https://orion.app/purchase/1",
      "{payment_link}": "N/A",
    },
  },
  {
    id: "payment_reminder",
    name: "Payment Reminder",
    badge: "Active",
    description: "Sent for overdue balances or pending payments",
    defaultTemplate: `Namaste {customer_name} 🙏\n\nThis is a friendly reminder that a balance of ₹{balance_due} is pending for Invoice {invoice_number}.\nDue Date: {date}\nStore: {shop_name}\n\nView & Pay: {invoice_link}\n\nThank you!`,
    sampleData: {
      "{customer_name}": "Vikram Malhotra",
      "{supplier_name}": "N/A",
      "{shop_name}": "Orion POS Store",
      "{invoice_number}": "INV-00098",
      "{purchase_number}": "N/A",
      "{quotation_number}": "N/A",
      "{amount}": "5,000",
      "{balance_due}": "1,500",
      "{date}": "25 Jul 2026",
      "{invoice_link}": "https://orion.app/invoice/INV-00098",
      "{payment_link}": "https://orion.app/pay/INV-00098",
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
      "{shop_name}": "Orion POS Store",
      "{invoice_number}": "N/A",
      "{purchase_number}": "N/A",
      "{quotation_number}": "QTN-2026-0089",
      "{amount}": "18,500",
      "{balance_due}": "0",
      "{date}": "25 Jul 2026",
      "{invoice_link}": "https://orion.app/quote/QTN-2026-0089",
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
      "{shop_name}": "Orion POS Store",
      "{invoice_number}": "EXP-9921",
      "{purchase_number}": "N/A",
      "{quotation_number}": "N/A",
      "{amount}": "3,200",
      "{balance_due}": "0",
      "{date}": "25 Jul 2026",
      "{invoice_link}": "https://orion.app/expenses/EXP-9921",
      "{payment_link}": "N/A",
    },
  },
];

/** Render template with custom data. Safely ignores unknown placeholders without errors. */
export function renderWhatsAppTemplate(templateText: string, data: Record<string, string>): string {
  let result = templateText || "";
  for (const [placeholder, value] of Object.entries(data)) {
    result = result.replaceAll(placeholder, value ?? "");
  }
  return result;
}
