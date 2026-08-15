/**
 * Apka Bill Mobile - Development Mock Printer Driver
 *
 * Simulates thermal receipt generation and ESC/POS-style text formatting.
 * Safe for development and emulator environments with zero physical dependencies.
 */

import { IPrinterDriver, PrinterStatus, ReceiptPayload, PrintResult } from '../types';
import ReceiptFormatter from '../utils/ReceiptFormatter';

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

    const receiptText = ReceiptFormatter.format58mmText(payload);
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
    return ReceiptFormatter.format58mmText(p);
  }
}

export default MockPrinterDriver;
