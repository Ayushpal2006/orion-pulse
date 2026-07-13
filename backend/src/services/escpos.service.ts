import { PrinterConfig } from "../types/printer.types";

export class EscposFormatter {
  private buffer: number[] = [];
  private paperWidth: "58mm" | "80mm";

  constructor(config: PrinterConfig) {
    this.paperWidth = config.paperWidth;
  }

  init() {
    this.buffer.push(0x1b, 0x40); // ESC @
    return this;
  }

  alignLeft() {
    this.buffer.push(0x1b, 0x61, 0); // ESC a 0
    return this;
  }

  alignCenter() {
    this.buffer.push(0x1b, 0x61, 1); // ESC a 1
    return this;
  }

  alignRight() {
    this.buffer.push(0x1b, 0x61, 2); // ESC a 2
    return this;
  }

  bold(enable: boolean) {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0); // ESC E n
    return this;
  }

  sizeNormal() {
    this.buffer.push(0x1d, 0x21, 0x00); // GS ! 0x00
    return this;
  }

  sizeDoubleWidth() {
    this.buffer.push(0x1d, 0x21, 0x10); // GS ! 0x10
    return this;
  }

  sizeDoubleHeight() {
    this.buffer.push(0x1d, 0x21, 0x01); // GS ! 0x01
    return this;
  }

  sizeDoubleWidthHeight() {
    this.buffer.push(0x1d, 0x21, 0x11); // GS ! 0x11
    return this;
  }

  text(str: string) {
    for (let i = 0; i < str.length; i++) {
      this.buffer.push(str.charCodeAt(i));
    }
    return this;
  }

  lineFeed(count: number = 1) {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  divider() {
    const charCount = this.paperWidth === "58mm" ? 32 : 48;
    this.text("-".repeat(charCount));
    this.lineFeed();
    return this;
  }

  cut() {
    this.buffer.push(0x1d, 0x56, 66, 0); // GS V 66 0
    return this;
  }

  row(left: string, right: string) {
    const totalChars = this.paperWidth === "58mm" ? 32 : 48;
    const spaceCount = totalChars - left.length - right.length;
    if (spaceCount > 0) {
      this.text(left + " ".repeat(spaceCount) + right);
    } else {
      this.text(left);
      this.lineFeed();
      this.text(" ".repeat(totalChars - right.length) + right);
    }
    this.lineFeed();
    return this;
  }

  barcode(data: string) {
    // GS w 3 (width)
    this.buffer.push(0x1d, 0x77, 3);
    // GS h 60 (height)
    this.buffer.push(0x1d, 0x68, 60);
    // GS H 2 (print HRI characters below barcode)
    this.buffer.push(0x1d, 0x48, 2);
    // GS k 73 (Code128) len data
    this.buffer.push(0x1d, 0x6b, 73, data.length);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i));
    }
    this.lineFeed();
    return this;
  }

  qrCode(data: string) {
    const len = data.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;
    
    // GS ( k pL pH 49 80 48 data (store QR code data)
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 49, 80, 48);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i));
    }
    
    // GS ( k 3 0 49 81 48 (print QR code)
    this.buffer.push(0x1d, 0x28, 0x6b, 3, 0, 49, 81, 48);
    this.lineFeed();
    return this;
  }

  formatReceipt(receipt: any): Buffer {
    this.init();

    // 1. Shop Info
    this.alignCenter();
    this.bold(true);
    this.sizeDoubleWidthHeight();
    this.text(receipt.shop.name);
    this.lineFeed();

    this.sizeNormal();
    this.bold(false);
    this.text(receipt.shop.address);
    this.lineFeed();
    this.text(`Phone: ${receipt.shop.phone}`);
    this.lineFeed();
    this.text(`GSTIN: ${receipt.shop.gstin}`);
    this.lineFeed();

    this.divider();

    // 2. Invoice Details
    this.alignLeft();
    this.text(`Invoice: ${receipt.invoiceNumber}`);
    this.lineFeed();
    this.text(`Date: ${receipt.date} ${receipt.time}`);
    this.lineFeed();
    this.text(`Cashier: ${receipt.cashier}`);
    this.lineFeed();
    this.text(`Customer: ${receipt.customer.name}`);
    this.lineFeed();
    if (receipt.customer.phone) {
      this.text(`Phone: +91 ${receipt.customer.phone}`);
      this.lineFeed();
    }

    this.divider();

    // 3. Items list
    this.text("Items Details");
    this.lineFeed();
    this.divider();
    for (const item of receipt.items) {
      this.row(`${item.qty}x ${item.name}`, `Rs ${item.lineTotal.toFixed(2)}`);
    }

    this.divider();

    // 4. Summary Breakdown
    this.row("Subtotal", `Rs ${receipt.subtotal.toFixed(2)}`);
    this.row("Discount", `Rs ${receipt.discount.toFixed(2)}`);
    this.row("GST", `Rs ${receipt.gst.toFixed(2)}`);

    this.divider();

    this.bold(true);
    this.row("GRAND TOTAL", `Rs ${receipt.grandTotal.toFixed(2)}`);
    this.bold(false);

    this.divider();

    // 5. Payment details & UPI
    this.alignCenter();
    this.text(`Paid via: ${receipt.paymentMethod}`);
    this.lineFeed();

    if (receipt.paymentMethod === "UPI") {
      this.lineFeed();
      this.text("Scan UPI to Pay:");
      this.lineFeed();
      this.qrCode(receipt.upiPayload);
      this.lineFeed();
    }

    // Invoice barcode
    this.lineFeed();
    this.text("Invoice Barcode:");
    this.lineFeed();
    this.barcode(receipt.invoiceNumber);
    this.lineFeed();

    this.divider();

    // 6. Thank You message
    this.bold(true);
    this.text(receipt.thankYouMessage);
    this.lineFeed();
    this.text("Visit Again");
    this.lineFeed(3); // extra feed spacing

    this.cut();

    return this.getBuffer();
  }

  getBuffer(): Buffer {
    return Buffer.from(this.buffer);
  }
}
