export function normalizeWhatsAppPhone(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  let phone = String(rawPhone).replace(/\D/g, "");

  // Reject empty, too short, or placeholder numbers made of one repeated digit (walk-in records use
  // 0000000000 or 9999999999); a bill must never be sent to a guessed number.
  if (!phone || phone.length < 10 || /^(\d)\1+$/.test(phone.length === 12 && phone.startsWith("91") ? phone.slice(2) : phone)) {
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
  /**
   * Formats INR amount cleanly for WhatsApp text (e.g. ₹1,200.00).
   */
  private formatInr(amount: number): string {
    const safe = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  }

  /**
   * Generates a concise, readable WhatsApp invoice summary without PDF or localhost URLs.
   * PDF link sharing is temporarily paused in WhatsApp workflows in favor of branded invoice images.
   */
  generateWhatsAppMessage(receipt: any): string {
    const shopName = String(receipt?.branding?.shopName || receipt?.shop?.name || "Apka Bill Store").trim();
    const rawCustomerName = String(receipt?.customer?.name || "").trim();
    const hasNamedCustomer =
      rawCustomerName.length > 0 && rawCustomerName.toLowerCase() !== "walk-in customer";
    const greeting = hasNamedCustomer ? `Hello ${rawCustomerName},` : "Hello,";

    const invoiceNum = String(receipt?.invoiceNumber || "INV").trim();
    const datePart = [receipt?.date, receipt?.time].filter(Boolean).join(", ").trim();
    const total = Number(receipt?.grandTotal ?? receipt?.total ?? 0);
    const rawBalance = receipt?.balance;
    const rawPaid = receipt?.paidAmount;
    const balance =
      rawBalance !== undefined && rawBalance !== null && rawBalance !== ""
        ? Math.max(0, Number(rawBalance))
        : rawPaid !== undefined && rawPaid !== null && rawPaid !== ""
          ? Math.max(0, total - Number(rawPaid))
          : 0;
    const paid =
      rawPaid !== undefined && rawPaid !== null && rawPaid !== ""
        ? Number(rawPaid) === 0 && balance === 0 && total > 0
          ? total
          : Math.max(0, Number(rawPaid))
        : Math.max(0, total - balance);

    const shopPhone = String(receipt?.branding?.phone || receipt?.shop?.phone || "").trim();

    const lines: string[] = [
      greeting,
      "",
      `Thank you for shopping with ${shopName}!`,
      "",
      `Invoice: ${invoiceNum}`,
      ...(datePart ? [`Date: ${datePart}`] : []),
      "",
      `Total Amount: ${this.formatInr(total)}`,
      `Paid: ${this.formatInr(paid)}`,
      `Balance: ${this.formatInr(balance)}`,
      "",
      "Your invoice image is attached.",
      ...(shopPhone ? ["", `Contact: ${shopPhone}`] : []),
      "",
      "Thank you for choosing us!",
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
