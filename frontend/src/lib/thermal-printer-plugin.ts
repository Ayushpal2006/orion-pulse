import { registerPlugin, Capacitor } from "@capacitor/core";

export interface BluetoothDeviceItem {
  name: string;
  address: string;
}

export interface UsbDeviceItem {
  deviceId: number;
  vendorId: number;
  productId: number;
  deviceName: string;
  productName?: string;
}

export interface PrinterConnectionOptions {
  connectionType: "bluetooth" | "lan" | "network" | "usb" | "escpos";
  macAddress?: string;
  bluetoothMac?: string;
  ip?: string;
  printerIp?: string;
  port?: number;
  printerPort?: number;
  vendorId?: number;
  productId?: number;
  printerDpi?: number;
  printableWidthMm?: number;
  charsPerLine?: number;
  autoCut?: boolean;
}

export interface ThermalPrinterPluginInterface {
  listBluetoothDevices(): Promise<{ devices: BluetoothDeviceItem[] }>;
  listUsbDevices(): Promise<{ devices: UsbDeviceItem[] }>;
  testConnection(options: PrinterConnectionOptions): Promise<{ success: boolean; message: string }>;
  printReceipt(options: PrinterConnectionOptions & { formattedText: string }): Promise<{ success: boolean; message: string }>;
  testPrint(options: PrinterConnectionOptions): Promise<{ success: boolean; message: string }>;
  getPrinterStatus(options?: PrinterConnectionOptions): Promise<{ success: boolean }>;
}

const NativeThermalPrinter = registerPlugin<ThermalPrinterPluginInterface>("ThermalPrinter");

export class ThermalPrinterBridge {
  static isNativeAvailable(): boolean {
    return Capacitor.isNativePlatform() || Capacitor.getPlatform() === "android";
  }

  static async listBluetoothDevices(): Promise<BluetoothDeviceItem[]> {
    if (!this.isNativeAvailable()) {
      console.warn("[ThermalPrinterBridge] Native platform not detected. Bluetooth device listing requires Android app environment.");
      return [];
    }
    try {
      const res = await NativeThermalPrinter.listBluetoothDevices();
      return res.devices || [];
    } catch (err) {
      console.error("[ThermalPrinterBridge] Error listing Bluetooth devices:", err);
      return [];
    }
  }

  static async listUsbDevices(): Promise<UsbDeviceItem[]> {
    if (!this.isNativeAvailable()) {
      return [];
    }
    try {
      const res = await NativeThermalPrinter.listUsbDevices();
      return res.devices || [];
    } catch (err) {
      console.error("[ThermalPrinterBridge] Error listing USB devices:", err);
      return [];
    }
  }

  static async testConnection(options: PrinterConnectionOptions): Promise<{ success: boolean; message: string }> {
    if (!this.isNativeAvailable()) {
      return { success: false, message: "Native Capacitor Android bridge is only available when running inside the Android App." };
    }
    try {
      return await NativeThermalPrinter.testConnection(options);
    } catch (err: any) {
      return { success: false, message: err?.message || String(err) };
    }
  }

  static async printReceipt(options: PrinterConnectionOptions & { formattedText: string }): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      throw new Error("Native Capacitor Android bridge is not available on web browser environment.");
    }
    const res = await NativeThermalPrinter.printReceipt(options);
    return res.success;
  }

  static async testPrint(options: PrinterConnectionOptions): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      throw new Error("Native Capacitor Android bridge is not available on web browser environment.");
    }
    const res = await NativeThermalPrinter.testPrint(options);
    return res.success;
  }
}
