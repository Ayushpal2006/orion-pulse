/**
 * Apka Bill Mobile - Thermal Receipt Formatter & Data Converter
 *
 * Formats sale records and store context into platform-neutral ReceiptPrintData
 * and 58mm thermal receipt layout (32 characters width).
 */

import { ReceiptPrintData, ReceiptItem } from '../types';
import { LocalSale, LocalSaleItem, LocalStore, CartItem } from '../../db/types';
import { AuthUser, OrganizationContext } from '../../types';

export class ReceiptFormatter {
  /**
   * Constructs authoritative ReceiptPrintData from sale record & current store context
   */
  static buildReceiptData(params: {
    sale: LocalSale;
    items: (LocalSaleItem | CartItem)[];
    store?: LocalStore | null;
    user?: AuthUser | null;
    organization?: OrganizationContext | null;
    settings?: Record<string, string>;
  }): ReceiptPrintData {
    const { sale, items, store, user, organization, settings } = params;

    // Store details source hierarchy: Store -> Settings -> Organization -> Default
    const storeName =
      store?.name ||
      settings?.['store.name'] ||
      organization?.name ||
      'Store';

    const storeAddress =
      store?.address ||
      settings?.['store.address'] ||
      (store?.city ? `${store.city}${store.state ? ', ' + store.state : ''}` : undefined);

    const storePhone = store?.phone || settings?.['store.phone'] || user?.phone || undefined;
    const storeGstin = store?.gst_number || settings?.['store.gstin'] || undefined;
    const website = settings?.['store.website'] || undefined;
    const upiId = settings?.['store.upi_id'] || settings?.['store.upiId'] || undefined;
    const footerText = settings?.['receipt.footer'] || 'Thank you for shopping with us!';

    // Map items
    const receiptItems: ReceiptItem[] = items.map((item) => {
      if ('product_name' in item) {
        // LocalSaleItem
        return {
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          total: item.total,
        };
      } else {
        // CartItem
        return {
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.selling_price,
          total: item.quantity * item.product.selling_price,
        };
      }
    });

    // Format date cleanly
    const saleDate = sale.created_at
      ? new Date(sale.created_at).toLocaleString('en-IN', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

    // Generate UPI / Invoice QR string
    const qrData = upiId
      ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(storeName)}&am=${(
          sale.grand_total / 100
        ).toFixed(2)}&cu=INR&tn=${encodeURIComponent(sale.local_invoice_number)}`
      : `BILL:${sale.local_invoice_number}`;

    return {
      storeName,
      storeAddress,
      storePhone,
      storeGstin,
      website,
      upiId,
      invoiceNumber: sale.local_invoice_number,
      date: saleDate,
      cashierName: sale.cashier_name || user?.name || 'Cashier',
      customerName: sale.customer_name || undefined,
      customerPhone: sale.customer_phone || undefined,
      items: receiptItems,
      subtotal: sale.subtotal,
      discount: sale.discount,
      gst: sale.tax_total,
      grandTotal: sale.grand_total,
      paymentMethod: sale.payment_method || 'Cash',
      footerText,
      qrData,
      paperWidth: '58mm',
    };
  }

  /**
   * Formats ReceiptPrintData into a 32-column string layout ideal for 58mm thermal rolls
   */
  static format58mmText(data: ReceiptPrintData): string {
    const WIDTH = 32;

    const padRight = (str: string, len: number) => {
      const s = String(str);
      return s.length > len ? s.substring(0, len) : s.padEnd(len, ' ');
    };

    const padLeft = (str: string, len: number) => {
      const s = String(str);
      return s.length > len ? s.substring(s.length - len) : s.padStart(len, ' ');
    };

    const center = (str: string) => {
      const s = String(str).substring(0, WIDTH);
      const leftMargin = Math.max(0, Math.floor((WIDTH - s.length) / 2));
      return ' '.repeat(leftMargin) + s;
    };

    const formatCurrency = (paise: number) => `INR ${(paise / 100).toFixed(2)}`;

    const lines: string[] = [];

    // Header / Branding
    lines.push(center(data.storeName.toUpperCase()));
    if (data.storeAddress) lines.push(center(data.storeAddress));
    if (data.storePhone) lines.push(center(`Ph: ${data.storePhone}`));
    if (data.storeGstin) lines.push(center(`GSTIN: ${data.storeGstin}`));
    if (data.website) lines.push(center(data.website));

    lines.push('-'.repeat(WIDTH));
    lines.push(`Inv: ${data.invoiceNumber}`);
    lines.push(`Date: ${data.date}`);
    if (data.cashierName) lines.push(`Cashier: ${data.cashierName}`);
    if (data.customerPhone) {
      lines.push(`Cust: ${data.customerName ? data.customerName + ' ' : ''}(${data.customerPhone})`);
    }

    lines.push('-'.repeat(WIDTH));

    // Item Table Header: Name (14), Qty (4), Price (6), Total (8) -> Total 32
    // Item (14) Qty(4) Price(6) Total(8)
    lines.push(
      padRight('Item', 14) +
        padLeft('Qty', 4) +
        padLeft('Price', 6) +
        padLeft('Total', 8)
    );
    lines.push('-'.repeat(WIDTH));

    for (const item of data.items) {
      const unitPriceStr = (item.unitPrice / 100).toFixed(0);
      const totalStr = (item.total / 100).toFixed(2);
      
      const line =
        padRight(item.name, 14) +
        padLeft(item.quantity.toString(), 4) +
        padLeft(unitPriceStr, 6) +
        padLeft(totalStr, 8);
      
      lines.push(line);
    }

    lines.push('-'.repeat(WIDTH));

    // Totals
    const subtotalStr = formatCurrency(data.subtotal);
    lines.push(padRight('Subtotal:', 18) + padLeft(subtotalStr, 14));

    if (data.discount > 0) {
      const discStr = `-${formatCurrency(data.discount)}`;
      lines.push(padRight('Discount:', 18) + padLeft(discStr, 14));
    }

    const gstStr = formatCurrency(data.gst);
    lines.push(padRight('GST:', 18) + padLeft(gstStr, 14));

    lines.push('='.repeat(WIDTH));

    const grandTotalStr = formatCurrency(data.grandTotal);
    lines.push(padRight('GRAND TOTAL:', 16) + padLeft(grandTotalStr, 16));
    lines.push('='.repeat(WIDTH));

    lines.push(`Payment: ${data.paymentMethod.toUpperCase()}`);

    if (data.qrData) {
      lines.push('-'.repeat(WIDTH));
      lines.push(center('[ SCAN QR CODE ]'));
      lines.push(center(data.qrData.length > 30 ? data.qrData.substring(0, 30) + '...' : data.qrData));
    }

    lines.push('-'.repeat(WIDTH));
    if (data.footerText) {
      lines.push(center(data.footerText));
    }

    return lines.join('\n');
  }
}

export default ReceiptFormatter;
