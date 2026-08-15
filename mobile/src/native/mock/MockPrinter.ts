/**
 * Apka Bill Mobile - Development Mock Printer Driver
 *
 * Simulates thermal receipt generation and ESC/POS-style text formatting.
 * Safe for development and emulator environments with zero physical dependencies.
 */

import { IPrinterDriver, PrinterStatus, ReceiptPayload, PrintResult } from '../types';

export class MockPrinterDriver implements IPrinterDriver {
  type = 'MOCK' as const;
  name = 'Development Virtual ESC/POS Printer';
  private isPaperOut = false;
  private isBusy = false;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<PrinterStatus> {
    if (this.isPaperOut) return 'PAPER_OUT';
    if (this.isBusy) return 'BUSY';
    return 'READY';
  }

  setSimulatePaperOut(val: boolean) {
    this.isPaperOut = val;
  }

  setSimulateBusy(val: boolean) {
    this.isBusy = val;
  }

  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    const status = await this.getStatus();
    if (status !== 'READY') {
      return {
        success: false,
        status,
        error: `Printer unavailable (Status: ${status})`,
      };
    }

    const receiptText = this.formatReceiptText(payload);
    console.log('\n========================================');
    console.log('🖨️ [MOCK THERMAL PRINTER OUTPUT]');
    console.log('========================================');
    console.log(receiptText);
    console.log('========================================\n');

    return {
      success: true,
      status: 'READY',
      bytesPrinted: receiptText.length,
      formattedText: receiptText,
    };
  }

  private formatReceiptText(p: ReceiptPayload): string {
    const pad = (str: string, len: number, right = false) => {
      const s = String(str).substring(0, len);
      return right ? s.padStart(len) : s.padEnd(len);
    };

    const formatCurrency = (paise: number) => `INR ${(paise / 100).toFixed(2)}`;

    const lines: string[] = [];
    lines.push(`         ${p.storeName.toUpperCase()}         `);
    if (p.storeAddress) lines.push(`     ${p.storeAddress}     `);
    if (p.storePhone) lines.push(`Phone: ${p.storePhone}`);
    if (p.storeGstin) lines.push(`GSTIN: ${p.storeGstin}`);
    lines.push('----------------------------------------');
    lines.push(`Invoice: ${p.invoiceNumber}`);
    lines.push(`Date:    ${p.date}`);
    if (p.cashierName) lines.push(`Cashier: ${p.cashierName}`);
    if (p.customerPhone) lines.push(`Customer: ${p.customerName || ''} (${p.customerPhone})`);
    lines.push('----------------------------------------');
    lines.push(`${pad('Item', 20)} ${pad('Qty', 4, true)} ${pad('Price', 6, true)} ${pad('Total', 8, true)}`);
    lines.push('----------------------------------------');

    for (const item of p.items) {
      const line = `${pad(item.name, 20)} ${pad(item.quantity.toString(), 4, true)} ${pad((item.unitPrice / 100).toFixed(0), 6, true)} ${pad((item.total / 100).toFixed(2), 8, true)}`;
      lines.push(line);
    }

    lines.push('----------------------------------------');
    lines.push(`${pad('Subtotal:', 28, true)} ${pad(formatCurrency(p.subtotal), 12, true)}`);
    if (p.discount > 0) {
      lines.push(`${pad('Discount:', 28, true)} ${pad(`-${formatCurrency(p.discount)}`, 12, true)}`);
    }
    lines.push(`${pad('GST (Tax):', 28, true)} ${pad(formatCurrency(p.gst), 12, true)}`);
    lines.push('========================================');
    lines.push(`${pad('GRAND TOTAL:', 26, true)} ${pad(formatCurrency(p.grandTotal), 14, true)}`);
    lines.push('========================================');
    lines.push(`Payment Mode: ${p.paymentMethod.toUpperCase()}`);
    lines.push('----------------------------------------');
    lines.push(`   ${p.footerText || 'Thank you for shopping with us!'}   `);

    return lines.join('\n');
  }
}

export default MockPrinterDriver;
