/**
 * Apka Bill Mobile - Native Printer Service
 *
 * Supports multiple printer drivers (Built-in POS, Bluetooth, USB, LAN, Mock).
 * Decoupled from checkout flow: physical printing errors NEVER rollback transactions.
 */

import { IPrinterDriver, PrinterType, ReceiptPayload, PrintResult, PrinterStatus } from './types';
import { MockPrinterDriver } from './mock/MockPrinter';

class PrinterServiceManager {
  private drivers: Map<PrinterType, IPrinterDriver> = new Map();
  private activeDriverType: PrinterType = 'MOCK';

  constructor() {
    // Default development driver
    const mock = new MockPrinterDriver();
    this.drivers.set('MOCK', mock);
  }

  registerDriver(driver: IPrinterDriver) {
    this.drivers.set(driver.type, driver);
  }

  setActiveDriver(type: PrinterType) {
    if (this.drivers.has(type)) {
      this.activeDriverType = type;
    } else {
      console.warn(`[PrinterService] Driver "${type}" not registered, falling back to MOCK.`);
      this.activeDriverType = 'MOCK';
    }
  }

  getActiveDriver(): IPrinterDriver {
    return this.drivers.get(this.activeDriverType) || this.drivers.get('MOCK')!;
  }

  async getStatus(): Promise<PrinterStatus> {
    const driver = this.getActiveDriver();
    return driver.getStatus();
  }

  /**
   * Safely attempts to print a receipt without blocking POS operations
   */
  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    const driver = this.getActiveDriver();
    console.log(`[PrinterService] Printing receipt "${payload.invoiceNumber}" using driver "${driver.name}"...`);

    try {
      const result = await driver.printReceipt(payload);
      if (!result.success) {
        console.warn(`[PrinterService] ⚠️ Print warning: ${result.error}`);
      }
      return result;
    } catch (err: any) {
      console.error('[PrinterService] ❌ Print exception:', err.message);
      return {
        success: false,
        status: 'ERROR',
        error: err.message || 'Unknown printer failure',
      };
    }
  }
}

export const PrinterService = new PrinterServiceManager();
export default PrinterService;
