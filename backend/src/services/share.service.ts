export function normalizeWhatsAppPhone(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  let phone = String(rawPhone).replace(/\D/g, "");

  // Reject empty, all zeros (dummy walk-in), or too short
  if (!phone || /^0+$/.test(phone) || phone.length < 10) {
    return null;
  }

  // Remove leading single zero (e.g. 09315900307 -> 9315900307)
  if (phone.length === 11 && phone.startsWith("0")) {
    phone = phone.slice(1);
  }

  // Already prefixed with 91 for 12-digit Indian number
  if (phone.length === 12 && phone.startsWith("91")) {
    return phone;
  }

  // Standard 10-digit Indian number -> prefix 91
  if (phone.length === 10) {
    return "91" + phone;
  }

  // International format (11 to 15 digits)
  if (phone.length >= 11 && phone.length <= 15) {
    return phone;
  }

  return null;
}

export class ShareService {
  generateWhatsAppMessage(receipt: any): string {
    const shopName = receipt.branding?.shopName || receipt.shop?.name || "Store";
    const customerName = receipt.customer?.name || "Customer";
    const invoiceNum = receipt.invoiceNumber;
    const amount = receipt.grandTotal;
    const token = receipt.publicToken || "";

    let host = process.env.BASE_URL;
    if (!host) {
      if (process.env.NODE_ENV === "production") {
        console.error("❌ [ShareService] ERROR: BASE_URL environment variable is missing in production!");
      }
      host = "http://localhost:8080";
    }
    const viewUrl = `${host}/invoice/v/${token}`;
    const downloadUrl = `${host}/invoice/v/${token}/download`;
    const shopPhone = receipt.branding?.phone || receipt.shop?.phone || "";

    const lines: string[] = [
      `Hi ${customerName} 👋`,
      "",
      `Thank you for shopping with ${shopName}.`,
      "",
      `*Invoice Number*`,
      invoiceNum,
      "",
      `*Amount Paid*`,
      `₹${amount.toFixed(2)}`,
      "",
      `*View Invoice*`,
      viewUrl,
      "",
      `*Download PDF*`,
      downloadUrl,
      "",
      ...(shopPhone ? [`Need help?`, `Call`, shopPhone, ""] : []),
      `Thank you ❤️`
    ];

    return lines.join("\n");
  }

  generateWhatsAppLink(receipt: any): string {
    const phone = normalizeWhatsAppPhone(receipt.customer?.phone);
    if (!phone) {
      throw new Error("Customer phone number is required to share on WhatsApp.");
    }

    const rawMessage = this.generateWhatsAppMessage(receipt);
    const encoded = encodeURIComponent(rawMessage);

    return `https://wa.me/${phone}?text=${encoded}`;
  }

  generateSupplierWhatsAppLink(purchase: any): string {
    const poNum = purchase.po_number || purchase.purchase_number;
    const supplierInv = purchase.invoice_number || purchase.supplier_invoice_number || "N/A";
    const amount = purchase.grand_total ? (purchase.grand_total / 100).toFixed(2) : "0.00";
    const supplierName = purchase.supplier_name || "Supplier";

    const lines: string[] = [
      `Namaste ${supplierName} 🙏`,
      "",
      `*Purchase Order:* ${poNum}`,
      `*Supplier Invoice:* ${supplierInv}`,
      `*Total Amount:* ₹${amount}`,
      "",
      `Thank you for your business!`
    ];

    const encoded = encodeURIComponent(lines.join("\n"));
    let phone = purchase.supplier_phone || "";
    phone = phone.replace(/[^0-9]/g, "");
    if (phone.length === 10) {
      phone = "91" + phone;
    }

    return `https://wa.me/${phone}?text=${encoded}`;
  }
}
