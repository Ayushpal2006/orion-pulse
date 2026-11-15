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

  qrCode(data: string, size: number = 3): this {
    const clean = String(data || "").trim();
    if (!clean) return this;
    // 1. Flush line buffer & Align Center
    this.align("center");
    const len = clean.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    // 2. Model: Model 2
    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 3. Size (Module size: 3 for 58mm / 4 for 80mm)
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
    // 4. Error correction level M (48)
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
    // 5. Store data
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    const encoder = new TextEncoder();
    this.buffer.push(...Array.from(encoder.encode(clean)));
    // 6. Print QR Code
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.buffer.push(0x0a); // LF to flush QR line buffer
    // 7. Explicitly restore LEFT alignment
    this.align("left");
    return this;
  }

  barcode(
    data: string,
    type: "CODE128" | "CODE39" = "CODE128",
    opts?: { width?: number; height?: number },
  ): this {
    const clean = String(data || "")
      .replace(/[^\x20-\x7E]/g, "")
      .trim()
      .slice(0, 32);
    if (!clean) return this;

    const moduleWidth = Math.min(Math.max(Math.round(opts?.width ?? 2), 1), 4);
    const barHeight = Math.min(Math.max(Math.round(opts?.height ?? 56), 24), 120);

    this.align("center");
    this.buffer.push(0x1d, 0x68, barHeight); // GS h height
    this.buffer.push(0x1d, 0x77, moduleWidth); // GS w module width
    this.buffer.push(0x1d, 0x48, 2); // GS H HRI text below barcode

    if (type === "CODE128") {
      const encoder = new TextEncoder();
      const encodedBytes = Array.from(encoder.encode(clean));
      const len = encodedBytes.length + 2;
      this.buffer.push(0x1d, 0x6b, 73, len, 0x7b, 0x42, ...encodedBytes); // GS k CODE128 {B
    } else {
      const encoder = new TextEncoder();
      const encodedBytes = Array.from(encoder.encode(clean.toUpperCase()));
      this.buffer.push(0x1d, 0x6b, 4, ...encodedBytes, 0x00); // GS k CODE39 NUL
    }
    this.buffer.push(0x0a);
    // Explicitly restore LEFT alignment
    this.align("left");
    return this;
  }

  rasterImage(
    pixelData: Uint8ClampedArray | Uint8Array | number[],
    width: number,
    height: number,
  ): this {
    // Width in dots must be a multiple of 8
    const widthBytes = Math.ceil(width / 8);
    const xL = widthBytes % 256;
    const xH = Math.floor(widthBytes / 256);
    const yL = height % 256;
    const yH = Math.floor(height / 256);

    this.align("center");
    // GS v 0 0 xL xH yL yH
    this.buffer.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    if (pixelData.length === widthBytes * height) {
      for (let i = 0; i < pixelData.length; i++) {
        this.buffer.push(pixelData[i]);
      }
    } else {
      // RGBA format: 4 bytes per pixel
      for (let y = 0; y < height; y++) {
        for (let b = 0; b < widthBytes; b++) {
          let byteVal = 0;
          for (let bit = 0; bit < 8; bit++) {
            const x = b * 8 + bit;
            if (x < width) {
              const idx = (y * width + x) * 4;
              const r = pixelData[idx];
              const g = pixelData[idx + 1];
              const b_ = pixelData[idx + 2];
              const a = pixelData[idx + 3];
              // Dark pixels with sufficient alpha become black dot (1)
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b_;
              if (a > 128 && luminance < 160) {
                byteVal |= 1 << (7 - bit);
              }
            }
          }
          this.buffer.push(byteVal);
        }
      }
    }

    this.buffer.push(0x0a);
    this.align("left");
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
