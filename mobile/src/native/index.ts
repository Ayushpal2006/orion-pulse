/**
 * Apka Bill Mobile - Native Hardware Module Placeholders
 *
 * NOTE: Hardware implementations (Thermal Printer, Barcode Scanner, Bluetooth/USB)
 * are reserved for subsequent phases. This file exports typed placeholder stubs.
 */

import {
  IThermalPrinterModule,
  IBarcodeScannerModule,
  IPosHardwareManager,
  PrinterDevice,
  PrintReceiptPayload,
} from './types';

export * from './types';

/**
 * Placeholder Thermal Printer implementation
 */
export const ThermalPrinterModule: IThermalPrinterModule = {
  async getAvailablePrinters(): Promise<PrinterDevice[]> {
    if (__DEV__) {
      console.warn('[NativeHardware] ThermalPrinterModule is not implemented yet in Phase 1.');
    }
    return [];
  },

  async connect(_printerId: string): Promise<boolean> {
    if (__DEV__) {
      console.warn('[NativeHardware] ThermalPrinterModule.connect is not implemented yet in Phase 1.');
    }
    return false;
  },

  async disconnect(): Promise<boolean> {
    return true;
  },

  async printReceipt(_payload: PrintReceiptPayload): Promise<boolean> {
    if (__DEV__) {
      console.warn('[NativeHardware] ThermalPrinterModule.printReceipt is not implemented yet in Phase 1.');
    }
    return false;
  },

  async getPrinterStatus(): Promise<'connected' | 'disconnected' | 'out_of_paper' | 'cover_open'> {
    return 'disconnected';
  },
};

/**
 * Placeholder Barcode Scanner implementation
 */
export const BarcodeScannerModule: IBarcodeScannerModule = {
  startListening(_onScan: (code: string) => void): () => void {
    if (__DEV__) {
      console.warn('[NativeHardware] BarcodeScannerModule is not implemented yet in Phase 1.');
    }
    return () => {};
  },

  stopListening(): void {
    // No-op in Phase 1
  },

  isHardwareScannerAvailable(): boolean {
    return false;
  },
};

/**
 * Global Hardware Manager stub
 */
export const PosHardwareManager: IPosHardwareManager = {
  printer: ThermalPrinterModule,
  scanner: BarcodeScannerModule,
  isReady: false,
};

export default PosHardwareManager;
