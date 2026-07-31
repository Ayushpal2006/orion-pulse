// Enterprise Hardware Abstraction Layer (HAL) for Apka Bill V2

import { PrintAdapter } from "./print-adapter";
import { RenderOptions } from "./universal-receipt-renderer";

export type HardwareDeviceType =
  | "printer"
  | "scanner"
  | "cash_drawer"
  | "customer_display"
  | "weighing_scale"
  | "fingerprint"
  | "nfc"
  | "msr"
  | "camera";

export type SupportedSdkManufacturer =
  | "Generic ESC/POS"
  | "Sunmi"
  | "iMin"
  | "Newland"
  | "Telpo"
  | "MoreFun"
  | "PAX"
  | "Wiseasy"
  | "Urovo"
  | "Rongta"
  | "XPrinter";

export interface HardwareDeviceStatus {
  deviceType: HardwareDeviceType;
  manufacturer: SupportedSdkManufacturer;
  isConnected: boolean;
  isBusy: boolean;
  batteryLevel?: number; // 0 - 100 for handheld POS terminals
  firmwareVersion?: string;
  driverVersion?: string;
  lastError?: string;
}

// Base Hardware Abstraction Interface
export interface IHardwareAdapter {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getStatus(): Promise<HardwareDeviceStatus>;
}

// 1. SDK PRINTER ADAPTERS FOR POS HARDWARE MANUFACTURERS
export class SunmiPosAdapter implements PrintAdapter, IHardwareAdapter {
  async connect(): Promise<boolean> {
    return typeof window !== "undefined" && typeof (window as any).SunmiPrinter !== "undefined";
  }

  async disconnect(): Promise<void> {}

  async getStatus(): Promise<HardwareDeviceStatus> {
    const isAvailable = await this.connect();
    return {
      deviceType: "printer",
      manufacturer: "Sunmi",
      isConnected: isAvailable,
      isBusy: false,
      firmwareVersion: "Sunmi OS v3.2",
      driverVersion: "SunmiPrinterSDK v2.1",
    };
  }

  async print(receipt: any, options?: RenderOptions): Promise<void> {
    if (typeof window !== "undefined" && (window as any).SunmiPrinter) {
      (window as any).SunmiPrinter.printReceipt(JSON.stringify(receipt));
    } else {
      console.log("[HAL] Sunmi POS Adapter Spooling:", receipt);
    }
  }
}

export class IMinPosAdapter implements PrintAdapter, IHardwareAdapter {
  async connect(): Promise<boolean> {
    return typeof window !== "undefined" && typeof (window as any).iMinPrinter !== "undefined";
  }

  async disconnect(): Promise<void> {}

  async getStatus(): Promise<HardwareDeviceStatus> {
    return {
      deviceType: "printer",
      manufacturer: "iMin",
      isConnected: await this.connect(),
      isBusy: false,
      firmwareVersion: "iMin UI 2.0",
      driverVersion: "iMinSDK v1.8",
    };
  }

  async print(receipt: any, options?: RenderOptions): Promise<void> {
    console.log("[HAL] iMin POS Adapter Spooling:", receipt);
  }
}

export class GenericEscPosHalAdapter implements PrintAdapter, IHardwareAdapter {
  async connect(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {}

  async getStatus(): Promise<HardwareDeviceStatus> {
    return {
      deviceType: "printer",
      manufacturer: "Generic ESC/POS",
      isConnected: true,
      isBusy: false,
      firmwareVersion: "ESC/POS v2.4",
      driverVersion: "Apka Bill Universal HAL v2.0",
    };
  }

  async print(receipt: any, options?: RenderOptions): Promise<void> {
    console.log("[HAL] Generic ESC/POS Driver Spooling:", receipt);
  }
}

// Hardware Abstraction Factory
export class HardwareAbstractionLayer {
  private static instance: HardwareAbstractionLayer;

  public static getInstance(): HardwareAbstractionLayer {
    if (!HardwareAbstractionLayer.instance) {
      HardwareAbstractionLayer.instance = new HardwareAbstractionLayer();
    }
    return HardwareAbstractionLayer.instance;
  }

  getSdkAdapter(manufacturer: SupportedSdkManufacturer): PrintAdapter & IHardwareAdapter {
    switch (manufacturer) {
      case "Sunmi":
        return new SunmiPosAdapter();
      case "iMin":
        return new IMinPosAdapter();
      default:
        return new GenericEscPosHalAdapter();
    }
  }
}

export const hal = HardwareAbstractionLayer.getInstance();
