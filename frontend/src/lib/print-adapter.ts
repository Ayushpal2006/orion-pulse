import { printSaleReceipt, downloadSalePdf } from "./api";
import { toast } from "sonner";
import { UniversalReceiptRenderer, RenderOptions } from "./universal-receipt-renderer";
import { UniversalReceiptModel, createCanonicalReceiptModel } from "./receipt-model";

export interface PrintAdapter {
  print(receipt: any, options?: RenderOptions): Promise<void>;
  testConnection?(): Promise<boolean>;
}

export async function waitForReceiptResources(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  const imagePromises = images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  });
  await Promise.all(imagePromises);

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function printPdfFallback(invoiceNumber: string): Promise<void> {
  const toastId = toast.loading("Generating PDF receipt...");
  try {
    const blob = await downloadSalePdf(invoiceNumber);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    toast.dismiss(toastId);
    toast.success("PDF generated successfully! Open browser options to print.");
  } catch (err: any) {
    toast.dismiss(toastId);
    toast.error("Failed to generate PDF fallback: " + (err.message || err));
  }
}

// 1. BROWSER PRINT ADAPTER
export class BrowserPrintAdapter implements PrintAdapter {
  async print(receipt: any): Promise<void> {
    const invoiceNumber = receipt?.invoiceNumber || (typeof receipt === "string" ? receipt : null);
    if (!invoiceNumber) {
      throw new Error("Unable to identify receipt invoice number");
    }
    if (typeof window !== "undefined") {
      window.open(`/print/invoice/${invoiceNumber}?autoprint=true`, "_blank");
    }
  }
}

// 2. USB THERMAL PRINTER ADAPTER (WebUSB API)
export class UsbPrinterAdapter implements PrintAdapter {
  async print(receipt: any, options?: RenderOptions): Promise<void> {
    if (typeof navigator === "undefined" || !(navigator as any).usb) {
      throw new Error("WebUSB is not supported in this browser. Please use Chrome or Edge.");
    }
    const toastId = toast.loading("Connecting to USB Thermal Printer...");
    try {
      const model: UniversalReceiptModel = createCanonicalReceiptModel(receipt);
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(0);

      const commands = UniversalReceiptRenderer.toEscPos(model, options);
      await device.transferOut(1, commands);
      await device.close();

      toast.dismiss(toastId);
      toast.success("Printed successfully to USB Thermal Printer!");
    } catch (err: any) {
      toast.dismiss(toastId);
      if (err.name === "NotFoundError") {
        throw new Error("USB Printer connection cancelled by user.");
      }
      throw new Error("USB Printer error: " + (err.message || err));
    }
  }

  async testConnection(): Promise<boolean> {
    if (typeof navigator === "undefined" || !(navigator as any).usb) return false;
    try {
      const devices = await (navigator as any).usb.getDevices();
      return devices.length > 0;
    } catch {
      return false;
    }
  }
}

// 3. BLUETOOTH THERMAL PRINTER ADAPTER (WebBluetooth API)
export class BluetoothPrinterAdapter implements PrintAdapter {
  async print(receipt: any, options?: RenderOptions): Promise<void> {
    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      throw new Error("WebBluetooth is not supported in this browser. Please use Chrome on Android or Desktop.");
    }
    const toastId = toast.loading("Searching for Bluetooth Thermal Printer...");
    try {
      const model: UniversalReceiptModel = createCanonicalReceiptModel(receipt);
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["00001101-0000-1000-8000-00805f9b34fb", "e7810a71-73ae-499d-8c15-faa9aef0c3f2"]
      });
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      if (services.length === 0) throw new Error("No GATT services found on Bluetooth device.");

      const characteristics = await services[0].getCharacteristics();
      if (characteristics.length === 0) throw new Error("No writable characteristics found on Bluetooth printer.");

      const commands = UniversalReceiptRenderer.toEscPos(model, options);
      await characteristics[0].writeValue(commands);

      toast.dismiss(toastId);
      toast.success("Printed successfully via Bluetooth!");
    } catch (err: any) {
      toast.dismiss(toastId);
      throw new Error("Bluetooth Printer error: " + (err.message || err));
    }
  }
}

// 4. NETWORK (LAN / WI-FI) PRINTER ADAPTER
export class NetworkPrinterAdapter implements PrintAdapter {
  async print(receipt: any, options?: RenderOptions): Promise<void> {
    const invoiceNumber = receipt?.invoiceNumber || (typeof receipt === "string" ? receipt : null);
    const toastId = toast.loading("Sending job to Network Thermal Printer...");
    try {
      if (invoiceNumber) {
        const res = await printSaleReceipt(invoiceNumber);
        toast.dismiss(toastId);
        toast.success(res?.message || "Network printer spooled successfully!");
      } else {
        throw new Error("Missing invoice identifier for network spooler.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      throw new Error("Network printer error: " + (err.message || err));
    }
  }
}

// 5. ANDROID POS TERMINAL PRINTER ADAPTER (Sunmi / PAX / Verifone / Z91)
export class AndroidPosPrinterAdapter implements PrintAdapter {
  async print(receipt: any, options?: RenderOptions): Promise<void> {
    if (typeof window !== "undefined" && (window as any).Android && typeof (window as any).Android.printReceipt === "function") {
      try {
        (window as any).Android.printReceipt(JSON.stringify(receipt));
        toast.success("Printed to POS Thermal Printer via Android SDK");
        return;
      } catch (err: any) {
        console.error("Android POS Native Print Error:", err);
      }
    }
    throw new Error("Android POS Printer interface is not detected on this hardware.");
  }
}

// Factory function resolving user's configured printer adapter
export function getPrintAdapter(configuredType: string = "browser"): PrintAdapter {
  const typeLower = (configuredType || "browser").toLowerCase();
  if (typeLower === "usb") return new UsbPrinterAdapter();
  if (typeLower === "bluetooth") return new BluetoothPrinterAdapter();
  if (typeLower === "network" || typeLower === "lan") return new NetworkPrinterAdapter();
  if (typeLower === "pos" || typeLower === "android") return new AndroidPosPrinterAdapter();
  return new BrowserPrintAdapter();
}
