import db from "../database/db";

export class ShareService {
  private getDbSetting(key: string, fallback: string): string {
    try {
      const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
      const row = stmt.get(key) as { value: string } | undefined;
      return row ? row.value : fallback;
    } catch (e) {
      return fallback;
    }
  }

  generateWhatsAppMessage(receipt: any): string {
    const shopName = receipt.shop.name;
    const customerName = receipt.customer.name;
    const invoiceNum = receipt.invoiceNumber;
    const amount = receipt.grandTotal;
    const token = receipt.publicToken || "";
    
    const host = "http://localhost:8080";
    const viewUrl = `${host}/invoice/v/${token}`;
    const downloadUrl = `${host}/invoice/v/${token}/download`;
    const shopPhone = receipt.shop.phone || "9876543210";

    const lines: string[] = [
      `Hi ${customerName} \uD83D\uDC4B`,
      "",
      `Thank you for shopping with ${shopName}.`,
      "",
      `*Invoice Number*`,
      invoiceNum,
      "",
      `*Amount Paid*`,
      `\u20B9${amount.toFixed(2)}`,
      "",
      `*View Invoice*`,
      viewUrl,
      "",
      `*Download PDF*`,
      downloadUrl,
      "",
      `Need help?`,
      `Call`,
      shopPhone,
      "",
      `Thank you \u2764\uFE0F`
    ];

    return lines.join("\n");
  }

  generateWhatsAppLink(receipt: any): string {
    const rawMessage = this.generateWhatsAppMessage(receipt);
    const encoded = encodeURIComponent(rawMessage);
    
    // Normalize phone number to strip spacing, non-digits
    let phone = receipt.customer.phone || "";
    phone = phone.replace(/[^0-9]/g, "");
    
    // Add default country code if 10 digits
    if (phone.length === 10) {
      phone = "91" + phone;
    }
    
    return `https://wa.me/${phone}?text=${encoded}`;
  }
}
