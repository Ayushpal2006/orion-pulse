/**
 * Apka Bill Mobile - Native Hardware Module Interfaces
 */

export type PrinterConnectionType = 'bluetooth' | 'usb' | 'network' | 'internal';

export interface PrinterDevice {
  id: string;
  name: string;
  type: PrinterConnectionType;
  address?: string; // MAC address or IP address
  isDefault?: boolean;
}

export interface PrintReceiptPayload {
  rawText?: string;
  commands?: string[];
  cutPaper?: boolean;
  openDrawer?: boolean;
  qrCode?: string;
  barcode?: string;
}

export interface IThermalPrinterModule {
  getAvailablePrinters(): Promise<PrinterDevice[]>;
  connect(printerId: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
  printReceipt(payload: PrintReceiptPayload): Promise<boolean>;
  getPrinterStatus(): Promise<'connected' | 'disconnected' | 'out_of_paper' | 'cover_open'>;
}

export interface IBarcodeScannerModule {
  startListening(onScan: (code: string) => void): () => void;
  stopListening(): void;
  isHardwareScannerAvailable(): boolean;
}

export interface IPosHardwareManager {
  printer: IThermalPrinterModule;
  scanner: IBarcodeScannerModule;
  isReady: boolean;
}
