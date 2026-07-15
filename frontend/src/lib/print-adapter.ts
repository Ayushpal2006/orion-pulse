import { printSaleReceipt, downloadSalePdf } from "./api";
import { toast } from "sonner";

export interface PrintAdapter {
  print(receipt: any): Promise<void>;
}

export async function waitForReceiptResources(container: HTMLElement): Promise<void> {
  // Wait for all images inside the print container to load/decode
  const images = Array.from(container.querySelectorAll("img"));
  const imagePromises = images.map((img) => {
    if (img.complete) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  });
  await Promise.all(imagePromises);

  // Wait for all fonts to load
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Wait two animation frames to guarantee layout paint
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function printPdfFallback(invoiceNumber: string): Promise<void> {
  const toastId = toast.loading("Generating PDF receipt...");
  try {
    const blob = await downloadSalePdf(invoiceNumber);
    const url = URL.createObjectURL(blob);
    
    // Open the PDF blob in a new window/tab for native print spooler
    window.open(url, "_blank");
    toast.dismiss(toastId);
    toast.success("PDF generated successfully! Open options in browser to print.");
  } catch (err: any) {
    toast.dismiss(toastId);
    toast.error("Failed to generate PDF fallback: " + (err.message || err));
  }
}

export class BrowserPrintAdapter implements PrintAdapter {
  async print(receipt: any): Promise<void> {
    const invoiceNumber = receipt?.invoiceNumber || (typeof receipt === "string" ? receipt : null);
    if (!invoiceNumber) {
      throw new Error("Unable to identify receipt invoice number");
    }
    // Launch the dedicated print page which acts as the single source of truth
    window.open(`/print/invoice/${invoiceNumber}?autoprint=true`, "_blank");
  }
}

export class PosPrintAdapter implements PrintAdapter {
  async print(receipt: any): Promise<void> {
    console.log("[PosPrintAdapter] Placeholder print called. Later this will invoke the Z91 Android SDK.", receipt);
    alert("Z91 POS SDK print triggered (Placeholder Mode)");
    
    const invoiceNumber = receipt?.invoiceNumber || (typeof receipt === "string" ? receipt : null);
    if (invoiceNumber) {
      await printSaleReceipt(invoiceNumber);
    }
  }
}

export function isRunningOnWeb(): boolean {
  if (typeof window === "undefined") return false;
  // If there's an Android interface injected (e.g. window.Android), it's the POS wrapper.
  return !(window as any).Android;
}

export function getPrintAdapter(): PrintAdapter {
  if (isRunningOnWeb()) {
    return new BrowserPrintAdapter();
  }
  return new PosPrintAdapter();
}
