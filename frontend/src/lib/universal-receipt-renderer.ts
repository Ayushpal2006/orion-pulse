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
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

import { getActiveTemplateConfig, ReceiptTemplateConfig } from "./receipt-template";

// 1. HTML OUTPUT RENDERER
export class HtmlRenderer {
  static render(model: UniversalReceiptModel, options?: RenderOptions & { templateConfig?: ReceiptTemplateConfig }): string {
    const tpl = options?.templateConfig || getActiveTemplateConfig();
    const paperWidth = options?.paperWidth || tpl.paperWidth || "80mm";
    const containerWidthClass = paperWidth === "58mm" ? "w-[58mm]" : paperWidth === "A4" ? "w-[210mm]" : "w-[80mm]";
    const borderStyle = tpl.dividerStyle === "solid" ? "1px solid #000" : tpl.dividerStyle === "double" ? "3px double #000" : "1px dashed #000";

    const itemsHtml = model.items
      .map(
        (item) => `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
          <span>${item.name}${tpl.body.showSku && item.sku ? ` (${item.sku})` : ""} x ${item.qty}</span>
          <span>₹${item.total.toFixed(2)}</span>
        </div>`
      )
      .join("");

    return `
      <div class="${containerWidthClass} p-4 font-mono text-black bg-white" style="font-family: monospace;">
        ${tpl.header.showLogo && model.business.logoUrl ? `<div style="text-align: ${tpl.header.logoPosition}; margin-bottom: 6px;"><img src="${model.business.logoUrl}" style="max-height: 40px; display: inline-block;" /></div>` : ""}
        ${tpl.header.showBusinessName ? `<div style="text-align: center; font-weight: bold; font-size: 16px;">${model.business.name}</div>` : ""}
        ${tpl.header.showStoreName && model.store.name ? `<div style="text-align: center; font-size: 11px; font-weight: 600;">${model.store.name}</div>` : ""}
        ${tpl.header.showAddress && model.business.address ? `<div style="text-align: center; font-size: 11px;">${model.business.address}</div>` : ""}
        ${tpl.header.showPhone && model.business.phone ? `<div style="text-align: center; font-size: 11px;">Ph: ${model.business.phone}</div>` : ""}
        ${tpl.header.showGstin && model.business.gstin ? `<div style="text-align: center; font-size: 11px;">GST: ${model.business.gstin}</div>` : ""}
        <hr style="border-top: ${borderStyle}; margin: 8px 0;" />
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          ${tpl.header.showInvoiceNumber ? `<span>Inv: ${model.invoiceNumber}</span>` : ""}
          ${tpl.header.showDate ? `<span>${model.date} ${tpl.header.showTime ? model.time || "" : ""}</span>` : ""}
        </div>
        ${model.customer?.name ? `<div style="font-size: 11px;">Customer: ${model.customer.name}</div>` : ""}
        ${tpl.header.showCashier && model.cashierName ? `<div style="font-size: 11px;">Cashier: ${model.cashierName}</div>` : ""}
        <hr style="border-top: ${borderStyle}; margin: 8px 0;" />
        ${itemsHtml}
        <hr style="border-top: ${borderStyle}; margin: 8px 0;" />
        ${tpl.summary.showSubtotal ? `<div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Subtotal:</span><span>₹${model.subtotal.toFixed(2)}</span></div>` : ""}
        ${tpl.summary.showDiscount && model.discount > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Discount:</span><span>-₹${model.discount.toFixed(2)}</span></div>` : ""}
        ${model.tax > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Tax:</span><span>₹${model.tax.toFixed(2)}</span></div>` : ""}
        <hr style="border-top: 2px solid #000; margin: 6px 0;" />
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;"><span>GRAND TOTAL:</span><span>₹${model.grandTotal.toFixed(2)}</span></div>
        ${tpl.summary.showPaymentMethod ? `<div style="font-size: 11px; margin-top: 4px;">Payment: ${model.payment.method}</div>` : ""}
        <hr style="border-top: ${borderStyle}; margin: 8px 0;" />
        <div style="text-align: center; font-size: 11px; margin-top: 8px;">${tpl.footer.thankYouMessage || model.footerText || "Thank you!"}</div>
        ${tpl.footer.termsText ? `<div style="text-align: center; font-size: 9px; color: #555; margin-top: 4px;">${tpl.footer.termsText}</div>` : ""}
        ${tpl.footer.showPoweredBy ? `<div style="text-align: center; font-size: 9px; font-weight: bold; margin-top: 6px;">Powered by Apka Bill POS</div>` : ""}
      </div>`;
  }
}

// 2. ESC/POS HARDWARE RENDERER
export class EscPosRenderer {
  static render(model: UniversalReceiptModel, options?: RenderOptions & { templateConfig?: ReceiptTemplateConfig }): Uint8Array {
    const encoder = new EscPosEncoder();
    const tpl = options?.templateConfig || getActiveTemplateConfig();
    const paperWidth = options?.paperWidth || tpl.paperWidth || "80mm";
    const maxLen = options?.charsPerLine || tpl.charsPerLine || (paperWidth === "58mm" ? 32 : paperWidth === "A4" ? 80 : 48);
    const divider = "-".repeat(maxLen);

    if (options?.openDrawer) {
      encoder.openCashDrawer();
    }

    // Header
    if (tpl.header.showBusinessName) encoder.align("center").bold(true).size(2, 2).line(model.business.name).size(1, 1).bold(false);
    if (tpl.header.showStoreName && model.store.name) encoder.line(model.store.name);
    if (tpl.header.showAddress && model.business.address) encoder.line(model.business.address);
    if (tpl.header.showPhone && model.business.phone) encoder.line(`Ph: ${model.business.phone}`);
    if (tpl.header.showGstin && model.business.gstin) encoder.line(`GST: ${model.business.gstin}`);

    encoder.align("left").line(divider);
    if (tpl.header.showInvoiceNumber) encoder.line(`Inv: ${model.invoiceNumber}  Date: ${model.date}`);
    if (model.customer?.name) encoder.line(`Customer: ${model.customer.name}`);
    if (tpl.header.showCashier && model.cashierName) encoder.line(`Cashier: ${model.cashierName}`);
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
    if (tpl.summary.showSubtotal) encoder.line(`Subtotal: ₹${model.subtotal.toFixed(2)}`);
    if (tpl.summary.showDiscount && model.discount > 0) encoder.line(`Discount: -₹${model.discount.toFixed(2)}`);
    if (model.tax > 0) encoder.line(`Tax: ₹${model.tax.toFixed(2)}`);
    encoder.bold(true).size(1, 2).line(`GRAND TOTAL: ₹${model.grandTotal.toFixed(2)}`).size(1, 1).bold(false);
    if (tpl.summary.showPaymentMethod) encoder.line(`Payment: ${model.payment.method}`);
    encoder.line(divider);

    // QR & Barcode
    if (tpl.footer.showQrCode && options?.showQr !== false && (model.qrCodeUrl || model.invoiceNumber)) {
      encoder.qrCode(model.qrCodeUrl || `https://apkabill.in/v/${model.invoiceNumber}`, 6);
    }
    if (tpl.footer.showBarcode && options?.showBarcode !== false && model.invoiceNumber) {
      encoder.barcode(model.invoiceNumber, "CODE128");
    }

    // Footer
    encoder.align("center").line(tpl.footer.thankYouMessage || model.footerText || "Thank you for shopping with us!");
    if (tpl.footer.termsText) encoder.line(tpl.footer.termsText);
    if (tpl.footer.showPoweredBy) encoder.line("Powered by Apka Bill POS");
    encoder.feed(3);

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

// 4. DANTSU FORMATTED TEXT RENDERER FOR NATIVE ANDROID ESC/POS
export class DantsuFormattedRenderer {
  static render(model: UniversalReceiptModel, options?: RenderOptions): string {
    const paperWidth = options?.paperWidth || "80mm";
    const maxLen = options?.charsPerLine || (paperWidth === "58mm" ? 32 : 48);
    const divider = "-".repeat(maxLen);

    const sb: string[] = [];

    // Header
    if (model.business.name) sb.push(`[C]<b><font size='big'>${model.business.name}</font></b>`);
    if (model.store?.name) sb.push(`[C]${model.store.name}`);
    if (model.business.address) sb.push(`[C]${model.business.address}`);
    if (model.business.phone) sb.push(`[C]Ph: ${model.business.phone}`);
    if (model.business.gstin) sb.push(`[C]GSTIN: ${model.business.gstin}`);

    sb.push(`[C]${divider}`);

    // Invoice details
    sb.push(`[L]Inv: ${model.invoiceNumber}[R]${model.date}`);
    if (model.customer?.name) sb.push(`[L]Customer: ${model.customer.name}`);
    if (model.cashierName) sb.push(`[L]Cashier: ${model.cashierName}`);

    sb.push(`[C]${divider}`);

    // Table Header
    sb.push(`[L]Item[R]Amount`);

    // Items
    for (const item of model.items) {
      const itemName = item.name.substring(0, Math.floor(maxLen * 0.6));
      sb.push(`[L]${itemName}`);
      sb.push(`[L]  ${item.qty} x ₹${item.price.toFixed(2)}[R]₹${item.total.toFixed(2)}`);
    }

    sb.push(`[C]${divider}`);

    // Summary
    sb.push(`[L]Subtotal:[R]₹${model.subtotal.toFixed(2)}`);
    if (model.discount > 0) sb.push(`[L]Discount:[R]-₹${model.discount.toFixed(2)}`);
    if (model.tax > 0) sb.push(`[L]Tax:[R]₹${model.tax.toFixed(2)}`);

    sb.push(`[C]--------------------------------`);
    sb.push(`[L]<b><font size='tall'>TOTAL:</font></b>[R]<b><font size='tall'>₹${model.grandTotal.toFixed(2)}</font></b>`);
    sb.push(`[C]--------------------------------`);

    if (model.payment?.method) {
      sb.push(`[L]Payment Method:[R]${model.payment.method}`);
    }

    sb.push(`[C]${divider}`);

    // QR Code
    if (options?.showQr !== false && (model.qrCodeUrl || model.invoiceNumber)) {
      const qrData = model.qrCodeUrl || `https://apkabill.in/v/${model.invoiceNumber}`;
      sb.push(`[C]<qrcode size='25'>${qrData}</qrcode>`);
    }

    // Footer
    sb.push(`[C]${model.footerText || "Thank you for your business!"}`);
    sb.push(`[C]Powered by Apka Bill POS`);
    sb.push(`\n`);

    if (options?.autoCut !== false) {
      sb.push(`[C]<cut/>`);
    }

    return sb.join("\n");
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

  static toDantsuFormattedText(model: UniversalReceiptModel, options?: RenderOptions): string {
    return DantsuFormattedRenderer.render(model, options);
  }

  static async toPdfBlob(invoiceNumber: string): Promise<Blob> {
    return await PdfRenderer.renderBlob(invoiceNumber);
  }
}
