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

import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ReceiptRenderer, ReceiptData } from "@/components/receipt-templates";

// 1. HTML OUTPUT RENDERER
export class HtmlRenderer {
  static render(model: UniversalReceiptModel | any, options?: RenderOptions & { templateConfig?: ReceiptTemplateConfig }): string {
    const tpl = options?.templateConfig || getActiveTemplateConfig();
    const templateName = model.template || (tpl as any).name || "Classic";
    const qrPosition = model.metadata?.qrPosition || (tpl.footer?.showQrCode ? "Bottom" : "None");
    const paperWidth = options?.paperWidth || tpl.paperWidth || "80mm";

    const receiptData: ReceiptData = {
      shop: {
        logo: model.business?.logoUrl || model.shop?.logo || "",
        name: model.business?.name || model.shop?.name || model.store?.name || "Store",
        address: model.business?.address || model.shop?.address || "",
        phone: model.business?.phone || model.shop?.phone || "",
        gstin: model.business?.gstin || model.shop?.gstin || "",
        upiId: model.metadata?.upiId || model.shop?.upiId || "",
      },
      invoiceNumber: model.invoiceNumber || "",
      date: model.date || "",
      time: model.time || "",
      cashier: model.cashierName || model.cashier || "Admin",
      customer: {
        name: model.customer?.name || "Walk-in Customer",
        phone: model.customer?.phone,
        gstin: model.customer?.gstin,
      },
      items: (model.items || []).map((it: any) => ({
        name: it.name || it.product_name || "Item",
        qty: Number(it.qty || it.quantity || 1),
        price: Number(it.price || it.selling_price || 0),
        discount: Number(it.discount || 0),
        gst: Number(it.tax || it.gst || 0),
        lineTotal: Number(it.total || it.lineTotal || it.line_total || (Number(it.price || 0) * Number(it.qty || 1))),
      })),
      subtotal: Number(model.subtotal || 0),
      discount: Number(model.discount || 0),
      gst: Number(model.tax || model.gst || 0),
      grandTotal: Number(model.grandTotal || model.grand_total || model.total || 0),
      paymentMethod: model.payment?.method || model.paymentMethod || "Cash",
      upiQrCode: model.metadata?.upiQrCode || model.upiQrCode,
      upiPayload: model.qrCodeUrl || model.upiPayload,
      thankYouMessage: model.footerText || model.thankYouMessage || tpl.footer?.thankYouMessage || "Thank you for shopping with us",
      invoiceHeader: model.metadata?.invoiceHeader || model.invoiceHeader,
      primaryColor: model.metadata?.primaryColor || model.primaryColor,
    };

    const containerWidth = paperWidth === "58mm" ? "58mm" : paperWidth === "A4" ? "210mm" : "80mm";

    const innerHtml = renderToStaticMarkup(
      React.createElement(ReceiptRenderer, {
        receipt: receiptData,
        templateName,
        qrPosition: qrPosition as any,
        paperWidth: paperWidth as any,
      })
    );

    return `
      <div style="width: ${containerWidth}; margin: 0 auto; background: #ffffff; color: #000000; box-sizing: border-box; padding: 2mm; font-family: sans-serif;">
        ${innerHtml}
      </div>
    `;
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

    // Items Table
    const nameWidth = maxLen === 48 ? 24 : 14;
    const qtyWidth = 4;
    const priceWidth = maxLen === 48 ? 8 : 6;
    const totalWidth = 8;

    const padRight = (str: string, len: number) => (str.length > len ? str.substring(0, len) : str.padEnd(len, " "));
    const padLeft = (str: string, len: number) => (str.length > len ? str.substring(str.length - len) : str.padStart(len, " "));

    encoder.line(
      padRight("Item", nameWidth) +
      padLeft("Qty", qtyWidth) +
      padLeft("Price", priceWidth) +
      padLeft("Total", totalWidth)
    );
    encoder.line(divider);

    for (const item of model.items) {
      const itemTotalStr = Number(item.total).toFixed(2);
      const itemPriceStr = Number(item.price).toFixed(0);
      const itemQtyStr = String(item.qty);

      if (item.name.length <= nameWidth) {
        encoder.line(
          padRight(item.name, nameWidth) +
          padLeft(itemQtyStr, qtyWidth) +
          padLeft(itemPriceStr, priceWidth) +
          padLeft(itemTotalStr, totalWidth)
        );
      } else {
        const firstChunk = item.name.substring(0, nameWidth);
        const restChunk = item.name.substring(nameWidth);
        encoder.line(
          padRight(firstChunk, nameWidth) +
          padLeft(itemQtyStr, qtyWidth) +
          padLeft(itemPriceStr, priceWidth) +
          padLeft(itemTotalStr, totalWidth)
        );
        encoder.line("  " + restChunk.substring(0, maxLen - 2));
      }
    }
    encoder.line(divider);

    // Totals
    const labelWidth = maxLen - 14;
    if (tpl.summary.showSubtotal) encoder.line(padRight("Subtotal:", labelWidth) + padLeft(`Rs.${Number(model.subtotal).toFixed(2)}`, 14));
    if (tpl.summary.showDiscount && model.discount > 0) encoder.line(padRight("Discount:", labelWidth) + padLeft(`-Rs.${Number(model.discount).toFixed(2)}`, 14));
    if (model.tax > 0) encoder.line(padRight("GST / Tax:", labelWidth) + padLeft(`Rs.${Number(model.tax).toFixed(2)}`, 14));
    encoder.bold(true).size(1, 2).line(padRight("GRAND TOTAL:", labelWidth) + padLeft(`Rs.${Number(model.grandTotal).toFixed(2)}`, 14)).size(1, 1).bold(false);
    if (tpl.summary.showPaymentMethod) encoder.line(`Payment: ${model.payment.method}`);
    encoder.line(divider);

    // QR & Barcode (Size 3 for 58mm / Size 4 for 80mm to guarantee centering without clipping)
    const qrSize = maxLen === 48 ? 4 : 3;
    if (tpl.footer.showQrCode && options?.showQr !== false && (model.qrCodeUrl || model.invoiceNumber)) {
      encoder.qrCode(model.qrCodeUrl || `https://apkabill.in/v/${model.invoiceNumber}`, qrSize);
      encoder.line();
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
