export class ShareService {
  generateWhatsAppMessage(receipt: any): string {
    const shopName = receipt.shop.name;
    const customerName = receipt.customer.name;
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
    const shopPhone = receipt.shop.phone || "8285068670";

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
      `Need help?`,
      `Call`,
      shopPhone,
      "",
      `Thank you ❤️`
    ];

    return lines.join("\n");
  }

  generateWhatsAppLink(receipt: any): string {
    const rawMessage = this.generateWhatsAppMessage(receipt);
    const encoded = encodeURIComponent(rawMessage);

    // Normalize phone number: strip spacing, dashes, non-digits
    let phone = receipt.customer?.phone || "";
    phone = phone.replace(/\D/g, "");

    // Clear dummy or invalid phone numbers (e.g. Walk-in Customer default "0000000000")
    if (!phone || /^0+$/.test(phone) || phone.length < 10) {
      phone = "";
    } else {
      // Remove leading zeros if present (e.g. 09876543210 -> 9876543210)
      if (phone.length === 11 && phone.startsWith("0")) {
        phone = phone.slice(1);
      }
      // Add country code 91 for 10-digit Indian mobile numbers
      if (phone.length === 10) {
        phone = "91" + phone;
      }
    }

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
