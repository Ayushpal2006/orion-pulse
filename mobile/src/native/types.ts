/**
 * Apka Bill Mobile - Native Hardware Abstraction Types
 */

export interface HardwareCapabilities {
  manufacturer: string;
  model: string;
  device: string;
  brand: string;
  sdkVersion: number;
  isPOSHardware: boolean;
  hasCamera: boolean;
  hasUsbHost: boolean;
  hasBluetooth: boolean;
  printerStatus: 'READY' | 'NOT_INITIALIZED' | 'NOT_DETECTED' | 'UNSUPPORTED';
  scannerStatus: 'READY' | 'NOT_INITIALIZED' | 'NOT_DETECTED' | 'UNSUPPORTED';
}

export type PrinterType = 'BUILT_IN' | 'BLUETOOTH' | 'USB' | 'LAN' | 'MOCK';

export type PrinterStatus =
  | 'READY'
  | 'NOT_AVAILABLE'
  | 'NOT_CONNECTED'
  | 'PAPER_OUT'
  | 'BUSY'
  | 'ERROR'
  | 'UNSUPPORTED';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptPayload {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  invoiceNumber: string;
  date: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  footerText?: string;
}

export interface PrintResult {
  success: boolean;
  status: PrinterStatus;
  bytesPrinted?: number;
  formattedText?: string;
  error?: string;
}

export interface IPrinterDriver {
  type: PrinterType;
  name: string;
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<PrinterStatus>;
  printReceipt(payload: ReceiptPayload): Promise<PrintResult>;
}

export type ScannerStatus = 'IDLE' | 'SCANNING' | 'NOT_AVAILABLE' | 'UNSUPPORTED';

export interface IScannerDriver {
  name: string;
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<ScannerStatus>;
  startScan(onBarcodeScanned: (barcode: string) => void): Promise<void>;
  stopScan(): Promise<void>;
}
