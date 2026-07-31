import { UniversalReceiptModel } from "./receipt-model";
import { EscPosEncoder } from "./esc-pos-encoder";
import { downloadSalePdf } from "./api";

export interface RenderOptions {
  paperWidth?: "58mm" | "80mm" | "A4";
  charsPerLine?: number;
  showLogo?: boolean;
  showQr?: boolean;
  showBarcode?: boolean;
  autoCut?: boolean;
  openDrawer?: boolean;
  copies?: number;
}

// 1. HTML OUTPUT RENDERER
export class HtmlRenderer {
  static render(model: UniversalReceiptModel, options?: RenderOptions): string {
    const paperWidth = options?.paperWidth || "80mm";
    const containerWidthClass = paperWidth === "58mm" ? "w-[58mm]" : paperWidth === "A4" ? "w-[210mm]" : "w-[80mm]";

    const itemsHtml = model.items
      .map(
        (item) => `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
          <span>${item.name} x ${item.qty}</span>
          <span>₹${item.total.toFixed(2)}</span>
        </div>`
      )
      .join("");

    return `
      <div class="${containerWidthClass} p-4 font-mono text-black bg-white" style="font-family: monospace;">
        <div style="text-align: center; font-weight: bold; font-size: 16px;">${model.business.name}</div>
        ${model.business.address ? `<div style="text-align: center; font-size: 11px;">${model.business.address}</div>` : ""}
        ${model.business.phone ? `<div style="text-align: center; font-size: 11px;">Ph: ${model.business.phone}</div>` : ""}
        ${model.business.gstin ? `<div style="text-align: center; font-size: 11px;">GST: ${model.business.gstin}</div>` : ""}
        <hr style="border-top: 1px dashed #000; margin: 8px 0;" />
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Inv: ${model.invoiceNumber}</span>
          <span>${model.date} ${model.time || ""}</span>
        </div>
        ${model.customer?.name ? `<div style="font-size: 11px;">Customer: ${model.customer.name}</div>` : ""}
        <hr style="border-top: 1px dashed #000; margin: 8px 0;" />
        ${itemsHtml}
        <hr style="border-top: 1px dashed #000; margin: 8px 0;" />
        <div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Subtotal:</span><span>₹${model.subtotal.toFixed(2)}</span></div>
        ${model.discount > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Discount:</span><span>-₹${model.discount.toFixed(2)}</span></div>` : ""}
        ${model.tax > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Tax:</span><span>₹${model.tax.toFixed(2)}</span></div>` : ""}
        <hr style="border-top: 2px solid #000; margin: 6px 0;" />
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;"><span>GRAND TOTAL:</span><span>₹${model.grandTotal.toFixed(2)}</span></div>
        <div style="font-size: 11px; margin-top: 4px;">Payment: ${model.payment.method}</div>
        <hr style="border-top: 1px dashed #000; margin: 8px 0;" />
        <div style="text-align: center; font-size: 11px; margin-top: 8px;">${model.footerText || "Thank you!"}</div>
      </div>`;
  }
}

// 2. ESC/POS HARDWARE RENDERER
export class EscPosRenderer {
  static render(model: UniversalReceiptModel, options?: RenderOptions): Uint8Array {
    const encoder = new EscPosEncoder();
    const paperWidth = options?.paperWidth || "80mm";
    const maxLen = options?.charsPerLine || (paperWidth === "58mm" ? 32 : paperWidth === "A4" ? 80 : 48);
    const divider = "-".repeat(maxLen);

    if (options?.openDrawer) {
      encoder.openCashDrawer();
    }

    // Header
    encoder.align("center").bold(true).size(2, 2).line(model.business.name).size(1, 1).bold(false);
    if (model.business.address) encoder.line(model.business.address);
    if (model.business.phone) encoder.line(`Ph: ${model.business.phone}`);
    if (model.business.gstin) encoder.line(`GST: ${model.business.gstin}`);

    encoder.align("left").line(divider);
    encoder.line(`Inv: ${model.invoiceNumber}  Date: ${model.date}`);
    if (model.customer?.name) encoder.line(`Customer: ${model.customer.name}`);
    encoder.line(divider);

    // Items
    for (const item of model.items) {
      const left = item.name.substring(0, maxLen - 15);
      const right = `${item.qty}x₹${item.price} = ₹${item.total}`;
      const space = " ".repeat(Math.max(1, maxLen - left.length - right.length));
      encoder.line(left + space + right);
    }
    encoder.line(divider);

    // Totals
    encoder.line(`Subtotal: ₹${model.subtotal.toFixed(2)}`);
    if (model.discount > 0) encoder.line(`Discount: -₹${model.discount.toFixed(2)}`);
    if (model.tax > 0) encoder.line(`Tax: ₹${model.tax.toFixed(2)}`);
    encoder.bold(true).size(1, 2).line(`GRAND TOTAL: ₹${model.grandTotal.toFixed(2)}`).size(1, 1).bold(false);
    encoder.line(`Payment: ${model.payment.method}`);
    encoder.line(divider);

    // QR & Barcode
    if (options?.showQr !== false && (model.qrCodeUrl || model.invoiceNumber)) {
      encoder.qrCode(model.qrCodeUrl || `https://apkabill.in/v/${model.invoiceNumber}`, 6);
    }
    if (options?.showBarcode !== false && model.invoiceNumber) {
      encoder.barcode(model.invoiceNumber, "CODE128");
    }

    // Footer
    encoder.align("center").line(model.footerText || "Thank you for shopping with us!").feed(3);

    if (options?.autoCut !== false) {
      encoder.cut(false);
    }

    return encoder.encode();
  }
}

// 3. PDF RENDERER
export class PdfRenderer {
  static async renderBlob(invoiceNumber: string): Promise<Blob> {
    return await downloadSalePdf(invoiceNumber);
  }
}

// UNIVERSAL RECEIPT RENDERER FACADE
export class UniversalReceiptRenderer {
  static toHtml(model: UniversalReceiptModel, options?: RenderOptions): string {
    return HtmlRenderer.render(model, options);
  }

  static toEscPos(model: UniversalReceiptModel, options?: RenderOptions): Uint8Array {
    return EscPosRenderer.render(model, options);
  }

  static async toPdfBlob(invoiceNumber: string): Promise<Blob> {
    return await PdfRenderer.renderBlob(invoiceNumber);
  }
}
