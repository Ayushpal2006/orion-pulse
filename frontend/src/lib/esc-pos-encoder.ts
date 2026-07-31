// Complete ESC/POS Binary Command Encoder for Thermal Printers

export class EscPosEncoder {
  private buffer: number[] = [];

  constructor() {
    this.reset();
  }

  reset(): this {
    this.buffer = [0x1b, 0x40]; // ESC @ (Initialize printer)
    return this;
  }

  align(alignment: "left" | "center" | "right"): this {
    const alignVal = alignment === "center" ? 1 : alignment === "right" ? 2 : 0;
    this.buffer.push(0x1b, 0x61, alignVal); // ESC a n
    return this;
  }

  bold(enable: boolean): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0); // ESC E n
    return this;
  }

  size(widthMultiplier: number = 1, heightMultiplier: number = 1): this {
    const w = Math.min(Math.max(widthMultiplier - 1, 0), 7);
    const h = Math.min(Math.max(heightMultiplier - 1, 0), 7);
    const n = (w << 4) | h;
    this.buffer.push(0x1d, 0x21, n); // GS ! n
    return this;
  }

  text(str: string): this {
    const encoder = new TextEncoder();
    const bytes = Array.from(encoder.encode(str));
    this.buffer.push(...bytes);
    return this;
  }

  line(str: string = ""): this {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  feed(lines: number = 1): this {
    this.buffer.push(0x1b, 0x64, lines); // ESC d n
    return this;
  }

  cut(fullCut: boolean = false): this {
    this.buffer.push(0x1d, 0x56, fullCut ? 0 : 1); // GS V n
    return this;
  }

  openCashDrawer(): this {
    this.buffer.push(0x1b, 0x70, 0, 25, 250); // ESC p 0 25 250 (Pulse pin 2)
    return this;
  }

  qrCode(data: string, size: number = 6): this {
    this.align("center");
    const len = data.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    // 1. Model: Model 2
    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
    // 3. Error correction level M (48)
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
    // 4. Store data
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    const encoder = new TextEncoder();
    this.buffer.push(...Array.from(encoder.encode(data)));
    // 5. Print QR Code
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  barcode(data: string, type: "CODE128" | "CODE39" = "CODE128"): this {
    this.align("center");
    this.buffer.push(0x1d, 0x68, 60); // GS h height (60 dots)
    this.buffer.push(0x1d, 0x77, 2);  // GS w width (2)
    this.buffer.push(0x1d, 0x48, 2);  // GS H text position (below)

    if (type === "CODE128") {
      const len = data.length + 2;
      this.buffer.push(0x1d, 0x6b, 73, len, 0x7b, 0x42); // GS k CODE128
      const encoder = new TextEncoder();
      this.buffer.push(...Array.from(encoder.encode(data)));
    }
    this.buffer.push(0x0a);
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
