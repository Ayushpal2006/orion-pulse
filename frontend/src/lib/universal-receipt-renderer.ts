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

// Helper functions for character-width deterministic layout
function wrapText(str: string, width: number): string[] {
  if (!str) return [];
  const words = str.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current ? current + " " + word : word).length <= width) {
      current = current ? current + " " + word : word;
    } else {
      if (current) lines.push(current);
      if (word.length > width) {
        let remaining = word;
        while (remaining.length > width) {
          lines.push(remaining.substring(0, width));
          remaining = remaining.substring(width);
        }
        current = remaining;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

// 2. ESC/POS HARDWARE RENDERER
export class EscPosRenderer {
  static render(model: UniversalReceiptModel, options?: RenderOptions & { templateConfig?: ReceiptTemplateConfig }): Uint8Array {
    const encoder = new EscPosEncoder();
    const tpl = options?.templateConfig || getActiveTemplateConfig();
    const paperWidth = options?.paperWidth || tpl.paperWidth || "58mm";
    const isSmallPaper = paperWidth === "58mm" || (paperWidth as string) === "55mm" || (paperWidth as string) === "2inch";
    const maxLen = options?.charsPerLine || (isSmallPaper ? 32 : 48);
    const divider = "-".repeat(maxLen);

    const padRight = (str: string, len: number) => (str.length > len ? str.substring(0, len) : str.padEnd(len, " "));
    const padLeft = (str: string, len: number) => (str.length > len ? str.substring(str.length - len) : str.padStart(len, " "));

    if (options?.openDrawer) {
      encoder.openCashDrawer();
    }

    // 1. Business Header
    encoder.align("center");
    if (model.business.name) {
      encoder.bold(true).size(2, 2).line(model.business.name).size(1, 1).bold(false);
    }
    if (model.store.name && model.store.name !== model.business.name) {
      encoder.line(model.store.name);
    }
    if (model.business.address) {
      wrapText(model.business.address, maxLen).forEach((l) => encoder.line(l));
    }
    if (model.business.phone) {
      encoder.line(`Ph: ${model.business.phone}`);
    }
    if (model.business.gstin) {
      encoder.line(`GSTIN: ${model.business.gstin}`);
    }

    // 2. Invoice & Customer Metadata
    encoder.align("left").line(divider);
    encoder.line(`INV: ${model.invoiceNumber}`);
    encoder.line(`DATE: ${model.date}`);
    if (model.time) {
      encoder.line(`TIME: ${model.time}`);
    }
    if (model.customer?.name && model.customer.name.trim() !== "" && model.customer.name !== "undefined" && model.customer.name !== "null") {
      wrapText(`CUSTOMER: ${model.customer.name}`, maxLen).forEach((l) => encoder.line(l));
    }
    if (model.customer?.phone && model.customer.phone.trim() !== "" && model.customer.phone !== "undefined" && model.customer.phone !== "null") {
      encoder.line(`PHONE: ${model.customer.phone}`);
    }
    if (model.cashierName && model.cashierName.trim() !== "" && model.cashierName !== "undefined" && model.cashierName !== "null") {
      encoder.line(`CASHIER: ${model.cashierName}`);
    }
    encoder.line(divider);

    // 3. Item Table Header
    const totalColWidth = 10;
    const nameColWidth = maxLen - totalColWidth;

    encoder.line(
      padRight("ITEM", nameColWidth) +
      padLeft("TOTAL", totalColWidth)
    );
    encoder.line(divider);

    // 4. Purchased Items
    for (const item of model.items) {
      const itemTotalStr = `₹${Number(item.total).toFixed(2)}`;
      const prefix = `${item.qty}x ${item.name}`;

      if (prefix.length <= nameColWidth) {
        encoder.line(
          padRight(prefix, nameColWidth) +
          padLeft(itemTotalStr, totalColWidth)
        );
      } else {
        const itemLines = wrapText(prefix, nameColWidth);
        encoder.line(
          padRight(itemLines[0] || prefix.substring(0, nameColWidth), nameColWidth) +
          padLeft(itemTotalStr, totalColWidth)
        );
        for (let i = 1; i < itemLines.length; i++) {
          encoder.line("   " + itemLines[i]);
        }
      }
    }
    encoder.line(divider);

    // 5. Totals
    const labelWidth = maxLen - 12;
    encoder.line(padRight("Subtotal", labelWidth) + padLeft(`₹${Number(model.subtotal).toFixed(2)}`, 12));
    encoder.line(padRight("Discount", labelWidth) + padLeft(`-₹${Number(model.discount || 0).toFixed(2)}`, 12));
    encoder.line(padRight("GST Tax", labelWidth) + padLeft(`₹${Number(model.tax || 0).toFixed(2)}`, 12));
    encoder.line(divider);
    encoder.bold(true).line(padRight("GRAND TOTAL", labelWidth) + padLeft(`₹${Number(model.grandTotal).toFixed(2)}`, 12)).bold(false);
    encoder.line(divider);

    // 6. Payment Method
    const payMethod = model.payment?.method || "Cash";
    encoder.line(`Paid via ${payMethod}`);

    // 7. Centered QR Code
    const qrSize = maxLen === 48 ? 4 : 3;
    if (options?.showQr !== false && (model.qrCodeUrl || model.invoiceNumber)) {
      encoder.line();
      encoder.qrCode(model.qrCodeUrl || `https://apkabill.in/v/${model.invoiceNumber}`, qrSize);
      encoder.align("center");
      encoder.line("Scan to Pay via UPI");
      encoder.line();
      encoder.align("left");
    }

    // 8. Barcode
    if (tpl.footer.showBarcode && options?.showBarcode !== false && model.invoiceNumber) {
      encoder.barcode(model.invoiceNumber, "CODE128");
    }

    // 9. Footer
    encoder.align("center");
    const footerMsg = model.footerText || tpl.footer.thankYouMessage || "Thank you for shopping with us!";
    wrapText(footerMsg, maxLen).forEach((l) => encoder.line(l));
    if (tpl.footer.termsText) {
      wrapText(tpl.footer.termsText, maxLen).forEach((l) => encoder.line(l));
    }
    encoder.line("Powered by Apka Bill POS");
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
    const paperWidth = options?.paperWidth || "58mm";
    const isSmallPaper = paperWidth === "58mm" || (paperWidth as string) === "55mm" || (paperWidth as string) === "2inch";
    const maxLen = options?.charsPerLine || (isSmallPaper ? 32 : 48);
    const divider = "-".repeat(maxLen);

    const sb: string[] = [];

    // Header
    if (model.business.name) sb.push(`[C]<b><font size='big'>${model.business.name}</font></b>`);
    if (model.store?.name && model.store.name !== model.business.name) sb.push(`[C]${model.store.name}`);
    if (model.business.address) sb.push(`[C]${model.business.address}`);
    if (model.business.phone) sb.push(`[C]Ph: ${model.business.phone}`);
    if (model.business.gstin) sb.push(`[C]GSTIN: ${model.business.gstin}`);

    sb.push(`[C]${divider}`);

    // Invoice details
    sb.push(`[L]INV: ${model.invoiceNumber}`);
    sb.push(`[L]DATE: ${model.date}`);
    if (model.time) sb.push(`[L]TIME: ${model.time}`);
    if (model.customer?.name && model.customer.name.trim() !== "" && model.customer.name !== "undefined" && model.customer.name !== "null") {
      sb.push(`[L]CUSTOMER: ${model.customer.name}`);
    }
    if (model.customer?.phone && model.customer.phone.trim() !== "" && model.customer.phone !== "undefined" && model.customer.phone !== "null") {
      sb.push(`[L]PHONE: ${model.customer.phone}`);
    }
    if (model.cashierName && model.cashierName.trim() !== "" && model.cashierName !== "undefined" && model.cashierName !== "null") {
      sb.push(`[L]CASHIER: ${model.cashierName}`);
    }

    sb.push(`[C]${divider}`);

    // Table Header
    sb.push(`[L]ITEM[R]TOTAL`);
    sb.push(`[C]${divider}`);

    // Items
    for (const item of model.items) {
      const itemTotalStr = `₹${Number(item.total).toFixed(2)}`;
      const prefix = `${item.qty}x ${item.name}`;
      sb.push(`[L]${prefix}[R]${itemTotalStr}`);
    }

    sb.push(`[C]${divider}`);

    // Summary
    sb.push(`[L]Subtotal[R]₹${Number(model.subtotal).toFixed(2)}`);
    sb.push(`[L]Discount[R]-₹${Number(model.discount || 0).toFixed(2)}`);
    sb.push(`[L]GST Tax[R]₹${Number(model.tax || 0).toFixed(2)}`);

    sb.push(`[C]${divider}`);
    sb.push(`[L]<b>GRAND TOTAL</b>[R]<b>₹${Number(model.grandTotal).toFixed(2)}</b>`);
    sb.push(`[C]${divider}`);

    // Payment Method
    const payMethod = model.payment?.method || "Cash";
    sb.push(`[L]Paid via ${payMethod}`);

    // QR Code
    if (options?.showQr !== false && (model.qrCodeUrl || model.invoiceNumber)) {
      const qrData = model.qrCodeUrl || `https://apkabill.in/v/${model.invoiceNumber}`;
      const qrSize = maxLen === 48 ? 25 : 20;
      sb.push(`\n[C]<qrcode size='${qrSize}'>${qrData}</qrcode>`);
      sb.push(`[C]Scan to Pay via UPI\n`);
    }

    // Footer
    sb.push(`[C]${model.footerText || "Thank you for shopping with us!"}`);
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
