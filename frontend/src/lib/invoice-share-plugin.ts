import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativeShareInvoiceImageInput {
  filename: string;
  base64: string;
}

export interface NativeShareInvoiceOptions {
  title?: string;
  text: string;
  phone?: string;
  images: NativeShareInvoiceImageInput[];
}

export interface NativeShareInvoiceResult {
  shared: boolean;
  fileCount: number;
  mode?: "whatsapp_direct" | "native_chooser";
  whatsappInstalled?: boolean;
}

interface InvoiceSharePluginInterface {
  shareInvoice(options: NativeShareInvoiceOptions): Promise<NativeShareInvoiceResult>;
}

const NativeInvoiceShare = registerPlugin<InvoiceSharePluginInterface>("InvoiceShare");

export const InvoiceShareBridge = {
  isNativeAvailable(): boolean {
    try {
      return Capacitor.isNativePlatform() || Capacitor.getPlatform() === "android";
    } catch {
      return false;
    }
  },

  async shareInvoice(options: NativeShareInvoiceOptions): Promise<NativeShareInvoiceResult> {
    if (!this.isNativeAvailable()) {
      throw new Error("Native invoice share is only available in the Capacitor Android app.");
    }
    return await NativeInvoiceShare.shareInvoice(options);
  },
};
