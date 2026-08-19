import { EscPosEncoder } from "./esc-pos-encoder";

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopGst?: string;
  invoiceNumber: string;
  date?: string;
  cashierName?: string;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  changeAmount?: number;
  footerText?: string;
  qrCodeUrl?: string;
  barcodeData?: string;
}

export interface ReceiptRenderOptions {
  paperWidth?: "58mm" | "80mm" | "A4";
  charsPerLine?: number;
  showLogo?: boolean;
  showQr?: boolean;
  showBarcode?: boolean;
  autoCut?: boolean;
  openDrawer?: boolean;
  copies?: number;
}

export class ReceiptRenderer {
  static getCharsPerLine(paperWidth: string = "80mm", customChars?: number): number {
    if (customChars && customChars > 0) return customChars;
    if (paperWidth === "58mm") return 32;
    if (paperWidth === "A4") return 80;
    return 48; // Default 80mm
  }

  static formatLine(left: string, right: string, maxLen: number): string {
    const spaceCount = Math.max(1, maxLen - left.length - right.length);
    return left + " ".repeat(spaceCount) + right;
  }

  static renderPlainText(data: ReceiptData, options?: ReceiptRenderOptions): string {
    const maxLen = this.getCharsPerLine(options?.paperWidth, options?.charsPerLine);
    const divider = "-".repeat(maxLen);
    const doubleDivider = "=".repeat(maxLen);
    const lines: string[] = [];

    // Header
    const shopName = (data.shopName || "").toUpperCase();
    if (shopName) lines.push(shopName.padStart(Math.floor((maxLen + shopName.length) / 2)));
    if (data.shopAddress) lines.push(data.shopAddress.padStart(Math.floor((maxLen + data.shopAddress.length) / 2)));
    if (data.shopPhone) lines.push(`Phone: ${data.shopPhone}`.padStart(Math.floor((maxLen + `Phone: ${data.shopPhone}`.length) / 2)));
    if (data.shopGst) lines.push(`GSTIN: ${data.shopGst}`.padStart(Math.floor((maxLen + `GSTIN: ${data.shopGst}`.length) / 2)));

    lines.push(divider);
    lines.push(this.formatLine(`Invoice: ${data.invoiceNumber}`, `Date: ${data.date || new Date().toLocaleDateString()}`, maxLen));
    if (data.customerName) lines.push(`Customer: ${data.customerName}`);
    if (data.customerPhone) lines.push(`Phone: ${data.customerPhone}`);
    if (data.cashierName) lines.push(`Cashier: ${data.cashierName}`);
    lines.push(divider);

    // Items
    lines.push(this.formatLine("ITEM", "QTY x PRICE  TOTAL", maxLen));
    lines.push(divider);

    for (const item of data.items || []) {
      const qtyPrice = `${item.qty} x ₹${item.price.toFixed(2)}`;
      const totalStr = `₹${item.total.toFixed(2)}`;
      lines.push(item.name.substring(0, maxLen));
      lines.push(this.formatLine(`  ${qtyPrice}`, totalStr, maxLen));
    }

    lines.push(doubleDivider);
    lines.push(this.formatLine("Subtotal:", `₹${data.subtotal.toFixed(2)}`, maxLen));
    if (data.discount > 0) lines.push(this.formatLine("Discount:", `-₹${data.discount.toFixed(2)}`, maxLen));
    if (data.tax > 0) lines.push(this.formatLine("Tax/GST:", `₹${data.tax.toFixed(2)}`, maxLen));
    lines.push(doubleDivider);
    lines.push(this.formatLine("GRAND TOTAL:", `₹${data.total.toFixed(2)}`, maxLen));
    lines.push(this.formatLine("Payment Method:", data.paymentMethod || "CASH", maxLen));
    lines.push(divider);

    // Footer
    const footerMsg = data.footerText || "Thank you for shopping with us!";
    lines.push(footerMsg.padStart(Math.floor((maxLen + footerMsg.length) / 2)));

    return lines.join("\n");
  }

  static renderEscPosCommands(data: ReceiptData, options?: ReceiptRenderOptions): Uint8Array {
    const encoder = new EscPosEncoder();
    const maxLen = this.getCharsPerLine(options?.paperWidth, options?.charsPerLine);
    const divider = "-".repeat(maxLen);

    if (options?.openDrawer) {
      encoder.openCashDrawer();
    }

    // Header
    if (data.shopName) {
      encoder.align("center").bold(true).size(2, 2).line(data.shopName).size(1, 1).bold(false);
    }
    if (data.shopAddress) encoder.line(data.shopAddress);
    if (data.shopPhone) encoder.line(`Phone: ${data.shopPhone}`);
    if (data.shopGst) encoder.line(`GSTIN: ${data.shopGst}`);

    encoder.align("left").line(divider);
    encoder.line(this.formatLine(`Inv: ${data.invoiceNumber}`, `Date: ${data.date || new Date().toLocaleDateString()}`, maxLen));
    if (data.customerName) encoder.line(`Customer: ${data.customerName}`);
    if (data.customerPhone) encoder.line(`Phone: ${data.customerPhone}`);
    encoder.line(divider);

    // Items
    encoder.bold(true).line(this.formatLine("ITEM", "QTY x PRICE  TOTAL", maxLen)).bold(false).line(divider);
    for (const item of data.items || []) {
      encoder.line(item.name.substring(0, maxLen));
      encoder.line(this.formatLine(`  ${item.qty} x ₹${item.price.toFixed(2)}`, `₹${item.total.toFixed(2)}`, maxLen));
    }
    encoder.line(divider);

    // Totals
    encoder.line(this.formatLine("Subtotal:", `₹${data.subtotal.toFixed(2)}`, maxLen));
    if (data.discount > 0) encoder.line(this.formatLine("Discount:", `-₹${data.discount.toFixed(2)}`, maxLen));
    if (data.tax > 0) encoder.line(this.formatLine("Tax/GST:", `₹${data.tax.toFixed(2)}`, maxLen));
    encoder.bold(true).size(1, 2).line(this.formatLine("GRAND TOTAL:", `₹${data.total.toFixed(2)}`, maxLen)).size(1, 1).bold(false);
    encoder.line(this.formatLine("Payment:", data.paymentMethod || "CASH", maxLen));
    encoder.line(divider);

    // QR & Barcode
    if (options?.showQr !== false && (data.qrCodeUrl || data.invoiceNumber)) {
      encoder.qrCode(data.qrCodeUrl || `https://apkabill.in/invoice/v/${data.invoiceNumber}`, 6);
    }
    if (options?.showBarcode !== false && data.invoiceNumber) {
      encoder.barcode(data.invoiceNumber, "CODE128");
    }

    // Footer
    encoder.align("center").line(data.footerText || "Thank you for shopping with us!").feed(3);

    if (options?.autoCut !== false) {
      encoder.cut(false);
    }

    return encoder.encode();
  }
}
