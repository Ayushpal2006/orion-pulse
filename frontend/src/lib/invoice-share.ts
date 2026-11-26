import {
  type NormalizedInvoiceData,
  type StoreBrandingOverride,
  buildWhatsAppDirectUrl,
  formatWhatsAppInvoiceText,
  normalizeInvoiceForShare,
  normalizeWhatsAppPhoneNumber,
} from "./invoice-share-format";
import { type GeneratedInvoiceImage, generateInvoiceImages } from "./invoice-image-generator";
import {
  InvoiceShareBridge,
  type NativeShareInvoiceResult,
} from "./invoice-share-plugin";

export type InvoiceShareMode =
  | "whatsapp_direct"
  | "native_sheet"
  | "web_share"
  | "web_fallback"
  | "cancelled";

export interface ShareInvoiceResult {
  mode: InvoiceShareMode;
  invoice: NormalizedInvoiceData;
  text: string;
  images: GeneratedInvoiceImage[];
  downloadedFiles: string[];
  copiedText: boolean;
  whatsappUrl?: string;
  shopWhatsappFallbackUrl?: string;
  popupBlocked?: boolean;
  message: string;
}

export interface PreOpenedWindowHandle {
  navigate: (url: string) => void;
  close: () => void;
}

export interface ShareCoordinatorDeps {
  isNativeAndroid?: () => boolean;
  shareViaNative?: (opts: {
    title: string;
    text: string;
    phone?: string;
    images: { filename: string; base64: string }[];
  }) => Promise<NativeShareInvoiceResult>;
  generateImages?: (invoice: NormalizedInvoiceData) => Promise<GeneratedInvoiceImage[]>;
  canShareFiles?: (data?: { files: File[]; text?: string; title?: string }) => boolean;
  webShare?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>;
  preOpenWindow?: () => PreOpenedWindowHandle | null;
  downloadImage?: (img: GeneratedInvoiceImage) => void;
  copyText?: (text: string) => Promise<boolean>;
  openWhatsAppUrl?: (url: string) => boolean;
}

function defaultDownloadImage(img: GeneratedInvoiceImage) {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(img.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = img.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function defaultCopyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      // Chrome can leave writeText pending forever once user activation is gone; never block sharing on it.
      return await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
      ]);
    }
  } catch {
    // Ignore clipboard rejection in restricted browser contexts
  }
  return false;
}

function defaultPreOpenWindow(): PreOpenedWindowHandle | null {
  if (typeof window === "undefined") return null;
  try {
    const win = window.open("", "_blank");
    if (!win) return null;
    // Prevent opener access while keeping handle alive for post-async navigation
    try {
      win.opener = null;
    } catch {
      // Ignore read-only opener errors
    }
    return {
      navigate: (url: string) => {
        try {
          win.location.href = url;
        } catch {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      },
      close: () => {
        try {
          win.close();
        } catch {
          // Ignore close errors
        }
      },
    };
  } catch {
    return null;
  }
}

function defaultOpenWhatsAppUrl(url: string): boolean {
  if (typeof window === "undefined") return false;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}

function defaultCanShareFiles(data?: { files: File[]; text?: string; title?: string }): boolean {
  try {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function"
    ) {
      return false;
    }
    // Desktop share sheets reject file shares (NotAllowedError) and burn the click, so the wa.me popup gets blocked.
    const uaMobile = (navigator as any).userAgentData?.mobile;
    if (!(uaMobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))) {
      return false;
    }
    if (data) {
      return navigator.canShare(data);
    }
    if (typeof File === "undefined") return false;
    return navigator.canShare({
      files: [new File(["x"], "probe.png", { type: "image/png" })],
      text: "probe",
    });
  } catch {
    return false;
  }
}

function createDefaultDeps(): Required<ShareCoordinatorDeps> {
  return {
    isNativeAndroid: () => InvoiceShareBridge.isNativeAvailable(),
    shareViaNative: (opts) => InvoiceShareBridge.shareInvoice(opts),
    generateImages: (invoice) => generateInvoiceImages(invoice),
    canShareFiles: defaultCanShareFiles,
    webShare: async (data) => {
      if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
        throw new Error("Web Share API is unavailable.");
      }
      await navigator.share(data);
    },
    preOpenWindow: defaultPreOpenWindow,
    downloadImage: defaultDownloadImage,
    copyText: defaultCopyText,
    openWhatsAppUrl: defaultOpenWhatsAppUrl,
  };
}

/**
 * Generates the branded invoice PNG image(s) + formatted WhatsApp INR summary locally
 * and opens WhatsApp directly (or native share sheet / browser fallback).
 *
 * - Valid customer phone -> redirects directly to customer's WhatsApp chat where supported.
 * - Missing/invalid phone -> opens WhatsApp contact picker / native share sheet (never guesses a number).
 * - Web fallback -> downloads image + opens WhatsApp with text-only summary (never claims image was attached).
 */
export async function shareInvoiceToWhatsApp(
  receipt: any,
  brandingOverride?: StoreBrandingOverride,
  customDeps?: ShareCoordinatorDeps,
): Promise<ShareInvoiceResult> {
  const deps = { ...createDefaultDeps(), ...customDeps };
  const invoice = normalizeInvoiceForShare(receipt, brandingOverride);
  const validCustomerPhone = normalizeWhatsAppPhoneNumber(invoice.customerPhone);
  const validShopPhone = normalizeWhatsAppPhoneNumber(invoice.shopPhone);

  const attachedMessageText = formatWhatsAppInvoiceText(invoice, { includeAttachmentNote: true });
  const textOnlyMessage = formatWhatsAppInvoiceText(invoice, { includeAttachmentNote: false });
  const shareTitle = `Invoice ${invoice.invoiceNumber} - ${invoice.shopName}`;

  const isNative = deps.isNativeAndroid();
  const supportsWebFileShare = !isNative && typeof File !== "undefined" && deps.canShareFiles();

  // Reserve a browser popup synchronously BEFORE any `await` when Web File Share is unavailable,
  // preventing Chrome/Safari/Firefox from blocking the `wa.me` redirect after canvas encoding.
  const preOpenedWin = !isNative && !supportsWebFileShare ? deps.preOpenWindow() : null;

  let images: GeneratedInvoiceImage[];
  try {
    images = await deps.generateImages(invoice);
  } catch (err) {
    preOpenedWin?.close();
    throw err;
  }

  if (!images || images.length === 0) {
    preOpenedWin?.close();
    throw new Error("Failed to generate invoice image for sharing.");
  }

  // 1. Capacitor Android native WhatsApp / share sheet (attaches FileProvider PNGs + text)
  if (isNative) {
    const nativeRes = await deps.shareViaNative({
      title: shareTitle,
      text: attachedMessageText,
      phone: validCustomerPhone || undefined,
      images: images.map((img) => ({ filename: img.filename, base64: img.base64 })),
    });
    const isDirect = nativeRes?.mode === "whatsapp_direct";
    return {
      mode: isDirect ? "whatsapp_direct" : "native_sheet",
      invoice,
      text: attachedMessageText,
      images,
      downloadedFiles: [],
      copiedText: false,
      message: isDirect
        ? "WhatsApp opened for customer with invoice image attached."
        : "Share sheet opened. Select WhatsApp contact or another app to send the invoice image.",
    };
  }

  // 2. Web Share API with PNG File attachment(s) where supported
  if (supportsWebFileShare && typeof File !== "undefined") {
    const files = images.map(
      (img) => new File([img.blob], img.filename, { type: "image/png" }),
    );
    const payload = { title: shareTitle, text: attachedMessageText, files };
    if (deps.canShareFiles(payload)) {
      try {
        await deps.webShare(payload);
        return {
          mode: "web_share",
          invoice,
          text: attachedMessageText,
          images,
          downloadedFiles: [],
          copiedText: false,
          message: "Share sheet opened with invoice image and summary.",
        };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return {
            mode: "cancelled",
            invoice,
            text: attachedMessageText,
            images,
            downloadedFiles: [],
            copiedText: false,
            message: "Sharing cancelled.",
          };
        }
        // Other rejections (e.g. Safari transient activation loss) fall through cleanly below
      }
    }
  }

  // 3. Browser Fallback (no file attachment via wa.me URL):
  // Download PNG locally, copy text summary, and open WhatsApp cleanly without claiming attached.
  const downloadedFiles: string[] = [];
  for (const img of images) {
    deps.downloadImage(img);
    downloadedFiles.push(img.filename);
  }
  const copiedText = await deps.copyText(textOnlyMessage);
  const whatsappUrl = buildWhatsAppDirectUrl(textOnlyMessage, validCustomerPhone);
  const shopWhatsappFallbackUrl =
    !validCustomerPhone && validShopPhone
      ? buildWhatsAppDirectUrl(textOnlyMessage, validShopPhone)
      : undefined;

  let popupBlocked = false;
  if (preOpenedWin) {
    preOpenedWin.navigate(whatsappUrl);
  } else {
    popupBlocked = !deps.openWhatsAppUrl(whatsappUrl);
  }

  const recipientNote = validCustomerPhone
    ? "WhatsApp opened for customer"
    : "WhatsApp opened so you can select a contact";

  return {
    mode: "web_fallback",
    invoice,
    text: textOnlyMessage,
    images,
    downloadedFiles,
    copiedText,
    whatsappUrl,
    shopWhatsappFallbackUrl,
    popupBlocked,
    message: popupBlocked
      ? "Invoice image downloaded to your device. Tap 'Open WhatsApp' to send the message and attach the downloaded image."
      : `${recipientNote}. Invoice image downloaded locally — attach the downloaded PNG in WhatsApp.`,
  };
}
