import { printSaleReceipt, downloadSalePdf } from "./api";
import { toast } from "sonner";
import { UniversalReceiptRenderer, RenderOptions } from "./universal-receipt-renderer";
import { UniversalReceiptModel, createCanonicalReceiptModel } from "./receipt-model";
import { ThermalPrinterBridge } from "./thermal-printer-plugin";

export interface PrintAdapter {
  print(receipt: any, options?: RenderOptions & { profile?: any; bluetoothMac?: string; printerIp?: string; printerPort?: number }): Promise<void>;
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

// 1. BROWSER PRINT ADAPTER (Zero-popup iframe print)
export class BrowserPrintAdapter implements PrintAdapter {
  async print(receipt: any, options?: RenderOptions): Promise<void> {
    const model = createCanonicalReceiptModel(receipt);
    const htmlContent = UniversalReceiptRenderer.toHtml(model, options);

    if (typeof window === "undefined") return;

    let iframe = document.getElementById("orion-silent-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "orion-silent-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0px";
      iframe.style.height = "0px";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      throw new Error("Unable to access browser print frame context.");
    }

    const paperWidth = options?.paperWidth || "80mm";
    const sizeValue = paperWidth === "80mm" ? "80mm auto" : paperWidth === "A4" ? "A4 portrait" : "58mm auto";
    const marginTop = options?.marginTop ?? 0;
    const marginBottom = options?.marginBottom ?? 0;
    const marginLeft = options?.marginLeft ?? 0;
    const marginRight = options?.marginRight ?? 0;

    const fullDocHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Receipt - ${model.invoiceNumber}</title>
          <style>
            @page {
              size: ${sizeValue};
              margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: monospace;
            }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    doc.open();
    doc.write(fullDocHtml);
    doc.close();

    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err: any) {
      console.warn("[BrowserPrintAdapter] Silent iframe print error:", err);
      throw new Error("Browser silent printing failed: " + (err.message || err));
    }
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}

// 2. USB THERMAL PRINTER ADAPTER (WebUSB API & Native Android Capacitor Bridge)
export class UsbPrinterAdapter implements PrintAdapter {
  async print(receipt: any, options?: RenderOptions & { profile?: any }): Promise<void> {
    const model: UniversalReceiptModel = createCanonicalReceiptModel(receipt);
    const toastId = toast.loading("Sending receipt to USB Thermal Printer...");

    // Native Capacitor Android Bridge
    if (ThermalPrinterBridge.isNativeAvailable()) {
      try {
        const formattedText = UniversalReceiptRenderer.toDantsuFormattedText(model, options);
        await ThermalPrinterBridge.printReceipt({
          connectionType: "usb",
          formattedText,
          autoCut: options?.autoCut ?? options?.profile?.autoCut ?? true,
          charsPerLine: options?.charsPerLine ?? options?.profile?.charactersPerLine ?? 48,
          printerDpi: options?.profile?.printerDpi ?? 203,
          printableWidthMm: options?.profile?.printableWidthMm ?? 72,
        });
        toast.dismiss(toastId);
        toast.success("Printed successfully to USB KP307 Printer!");
        return;
      } catch (err: any) {
        toast.dismiss(toastId);
        throw new Error("Android USB Printer error: " + (err.message || err));
      }
    }

    // WebUSB API Fallback
    if (typeof navigator === "undefined" || !(navigator as any).usb) {
      toast.dismiss(toastId);
      throw new Error("WebUSB is not supported in this browser. Please use Chrome or Android Native App.");
    }
    try {
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
    if (ThermalPrinterBridge.isNativeAvailable()) {
      const res = await ThermalPrinterBridge.testConnection({ connectionType: "usb" });
      return res.success;
    }
    if (typeof navigator === "undefined" || !(navigator as any).usb) return false;
    try {
      const devices = await (navigator as any).usb.getDevices();
      return devices.length > 0;
    } catch {
      return false;
    }
  }
}

// 3. BLUETOOTH THERMAL PRINTER ADAPTER (WebBluetooth API & Native Android Capacitor Bridge)
export class BluetoothPrinterAdapter implements PrintAdapter {
  async print(receipt: any, options?: RenderOptions & { profile?: any; bluetoothMac?: string }): Promise<void> {
    const model: UniversalReceiptModel = createCanonicalReceiptModel(receipt);
    const toastId = toast.loading("Sending receipt to Bluetooth KP307 Thermal Printer...");

    const mac = options?.bluetoothMac || options?.profile?.bluetoothMac;

    // Native Capacitor Android Bridge (Direct ESC/POS to KP307)
    if (ThermalPrinterBridge.isNativeAvailable()) {
      try {
        const formattedText = UniversalReceiptRenderer.toDantsuFormattedText(model, options);
        await ThermalPrinterBridge.printReceipt({
          connectionType: "bluetooth",
          macAddress: mac,
          bluetoothMac: mac,
          formattedText,
          autoCut: options?.autoCut ?? options?.profile?.autoCut ?? true,
          charsPerLine: options?.charsPerLine ?? options?.profile?.charactersPerLine ?? 48,
          printerDpi: options?.profile?.printerDpi ?? 203,
          printableWidthMm: options?.profile?.printableWidthMm ?? 72,
        });
        toast.dismiss(toastId);
        toast.success("Printed successfully via Bluetooth to KP307!");
        return;
      } catch (err: any) {
        toast.dismiss(toastId);
        throw new Error("Android Bluetooth Printer error: " + (err.message || err));
      }
    }

    // WebBluetooth Fallback
    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      toast.dismiss(toastId);
      throw new Error("WebBluetooth is not supported in this browser. Please run inside the Android POS App.");
    }
    try {
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
      
      const chunkSize = 512;
      for (let i = 0; i < commands.length; i += chunkSize) {
        const chunk = commands.slice(i, i + chunkSize);
        await characteristics[0].writeValue(chunk);
      }

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
  async print(receipt: any, options?: RenderOptions & { profile?: any; printerIp?: string; printerPort?: number }): Promise<void> {
    const model: UniversalReceiptModel = createCanonicalReceiptModel(receipt);
    const ip = options?.printerIp || options?.profile?.printerIp;
    const port = options?.printerPort || options?.profile?.printerPort || 9100;
    const toastId = toast.loading("Sending job to Network KP307 Printer...");

    // Direct Native Android TCP Printing
    if (ThermalPrinterBridge.isNativeAvailable() && ip) {
      try {
        const formattedText = UniversalReceiptRenderer.toDantsuFormattedText(model, options);
        await ThermalPrinterBridge.printReceipt({
          connectionType: "lan",
          ip,
          port,
          formattedText,
          autoCut: options?.autoCut ?? options?.profile?.autoCut ?? true,
          charsPerLine: options?.charsPerLine ?? options?.profile?.charactersPerLine ?? 48,
          printerDpi: options?.profile?.printerDpi ?? 203,
          printableWidthMm: options?.profile?.printableWidthMm ?? 72,
        });
        toast.dismiss(toastId);
        toast.success(`Printed successfully to Network Printer (${ip}:${port})!`);
        return;
      } catch (err: any) {
        toast.dismiss(toastId);
        throw new Error("Native TCP Printer error: " + (err.message || err));
      }
    }

    // Backend Spooler Fallback
    const invoiceNumber = receipt?.invoiceNumber || (typeof receipt === "string" ? receipt : null);
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

// 5. ANDROID POS TERMINAL PRINTER ADAPTER (Sunmi / iMin / PAX / Verifone / Z91)
export class AndroidPosPrinterAdapter implements PrintAdapter {
  async print(receipt: any, options?: RenderOptions): Promise<void> {
    if (typeof window !== "undefined") {
      const model = createCanonicalReceiptModel(receipt);
      const payloadJson = JSON.stringify(receipt);

      // Check Sunmi Native SDK Interface
      if ((window as any).SunmiPrinter && typeof (window as any).SunmiPrinter.printReceipt === "function") {
        (window as any).SunmiPrinter.printReceipt(payloadJson);
        toast.success("Receipt printed to Sunmi POS Thermal Printer");
        return;
      }

      // Check iMin Native SDK Interface
      if ((window as any).iMinPrinter && typeof (window as any).iMinPrinter.printReceipt === "function") {
        (window as any).iMinPrinter.printReceipt(payloadJson);
        toast.success("Receipt printed to iMin POS Thermal Printer");
        return;
      }

      // Check Generic Android Javascript Bridge
      if ((window as any).Android && typeof (window as any).Android.printReceipt === "function") {
        (window as any).Android.printReceipt(payloadJson);
        toast.success("Receipt printed to Android POS Thermal Printer");
        return;
      }

      // Capacitor Native Bridge Fallback
      if (ThermalPrinterBridge.isNativeAvailable()) {
        const formattedText = UniversalReceiptRenderer.toDantsuFormattedText(model, options);
        await ThermalPrinterBridge.printReceipt({
          connectionType: "bluetooth",
          formattedText,
          autoCut: options?.autoCut ?? true,
        });
        toast.success("Receipt printed via Capacitor Thermal Printer Plugin");
        return;
      }
    }
    throw new Error(
      "Built-in Android POS Printer hardware interface is not detected on this device model."
    );
  }
}

// Factory function resolving user's configured printer adapter
export function getPrintAdapter(configuredType: string = "browser"): PrintAdapter {
  const typeLower = (configuredType || "browser").toLowerCase();
  if (typeLower === "usb") return new UsbPrinterAdapter();
  if (typeLower === "bluetooth" || typeLower === "escpos") return new BluetoothPrinterAdapter();
  if (typeLower === "network" || typeLower === "lan") return new NetworkPrinterAdapter();
  if (
    typeLower === "pos" ||
    typeLower === "android" ||
    typeLower === "android_pos" ||
    typeLower === "sunmi" ||
    typeLower === "imin"
  ) {
    return new AndroidPosPrinterAdapter();
  }
  return new BrowserPrintAdapter();
}
