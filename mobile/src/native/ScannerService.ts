/**
 * Apka Bill Mobile - Native Barcode Scanner Service Abstraction
 *
 * Supports hardware scanners, camera scanners, and external USB/Bluetooth barcode readers.
 */

import { IScannerDriver, ScannerStatus } from './types';

class DefaultScannerDriver implements IScannerDriver {
  name = 'Hardware Barcode Scanner Driver (Uninitialized)';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async getStatus(): Promise<ScannerStatus> {
    return 'NOT_AVAILABLE';
  }

  async startScan(_onBarcodeScanned: (barcode: string) => void): Promise<void> {
    console.warn('[ScannerService] Hardware barcode scanner not available or SDK not connected.');
  }

  async stopScan(): Promise<void> {
    // No-op
  }
}

class ScannerServiceManager {
  private activeDriver: IScannerDriver = new DefaultScannerDriver();

  registerDriver(driver: IScannerDriver) {
    this.activeDriver = driver;
  }

  async isAvailable(): Promise<boolean> {
    return this.activeDriver.isAvailable();
  }

  async getStatus(): Promise<ScannerStatus> {
    return this.activeDriver.getStatus();
  }

  async startScan(onBarcodeScanned: (barcode: string) => void): Promise<void> {
    return this.activeDriver.startScan(onBarcodeScanned);
  }

  async stopScan(): Promise<void> {
    return this.activeDriver.stopScan();
  }
}

export const ScannerService = new ScannerServiceManager();
export default ScannerService;
