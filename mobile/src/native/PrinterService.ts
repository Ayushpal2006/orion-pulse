/**
 * Apka Bill Mobile - Native Printer Service
 *
 * Supports multiple printer drivers (Built-in POS, Bluetooth, USB, LAN, Mock).
 * Decoupled from checkout flow: physical printing errors NEVER rollback transactions.
 */

import { IPrinterDriver, PrinterType, ReceiptPayload, PrintResult, PrinterStatus } from './types';
import { MockPrinterDriver } from './mock/MockPrinter';
import { AndroidPrinterDriver } from './drivers/AndroidPrinterDriver';
import ReceiptFormatter from './utils/ReceiptFormatter';
import { LocalSale, LocalSaleItem, LocalStore, CartItem } from '../db/types';
import { AuthUser, OrganizationContext } from '../types';

class PrinterServiceManager {
  private drivers: Map<PrinterType, IPrinterDriver> = new Map();
  private activeDriverType: PrinterType = 'BUILT_IN';

  constructor() {
    const mock = new MockPrinterDriver();
    const android = new AndroidPrinterDriver();

    this.drivers.set('MOCK', mock);
    this.drivers.set('BUILT_IN', android);
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

  async isAvailable(): Promise<boolean> {
    const driver = this.getActiveDriver();
    return driver.isAvailable();
  }

  async getStatus(): Promise<PrinterStatus> {
    const driver = this.getActiveDriver();
    return driver.getStatus();
  }

  /**
   * Safely attempts to print a receipt without blocking POS operations
   */
  async printReceipt(payload: ReceiptPayload): Promise<PrintResult> {
    let driver = this.getActiveDriver();

    // Check if active driver is available; fallback to mock if hardware driver fails
    const available = await driver.isAvailable();
    if (!available && this.activeDriverType !== 'MOCK') {
      console.log(`[PrinterService] Driver "${driver.name}" unavailable. Using fallback driver.`);
      driver = this.drivers.get('MOCK')!;
    }

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

  /**
   * Formats a local sale and triggers print (used during checkout or reprint)
   */
  async printSale(params: {
    sale: LocalSale;
    items: (LocalSaleItem | CartItem)[];
    store?: LocalStore | null;
    user?: AuthUser | null;
    organization?: OrganizationContext | null;
    settings?: Record<string, string>;
  }): Promise<PrintResult> {
    const receiptData = ReceiptFormatter.buildReceiptData(params);
    return this.printReceipt(receiptData);
  }
}

export const PrinterService = new PrinterServiceManager();
export default PrinterService;
