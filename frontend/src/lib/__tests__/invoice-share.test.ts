import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INVOICE_MAX_PAGE_HEIGHT,
  buildWhatsAppDirectUrl,
  formatInrCurrency,
  formatWhatsAppInvoiceText,
  normalizeInvoiceForShare,
  normalizeWhatsAppPhoneNumber,
  planInvoiceImagePages,
  wrapTextForCanvas,
} from "../invoice-share-format";
import { shareInvoiceToWhatsApp } from "../invoice-share";
import type { GeneratedInvoiceImage } from "../invoice-image-generator";

function makeFakeImage(filename: string, pageNumber = 1, totalPages = 1): GeneratedInvoiceImage {
  return {
    filename,
    pageNumber,
    totalPages,
    width: 900,
    height: 1100,
    blob: new Blob(["png-bytes"], { type: "image/png" }),
    base64: "iVBORw0KGgo=",
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
  };
}

describe("Invoice Share Formatting & Layout", () => {
  it("formats INR values cleanly with grouping and two decimals", () => {
    assert.equal(formatInrCurrency(1200), "₹1,200.00");
    assert.equal(formatInrCurrency(24500.5), "₹24,500.50");
    assert.equal(formatInrCurrency(0), "₹0.00");
    assert.equal(formatInrCurrency(-0), "₹0.00");
    assert.equal(formatInrCurrency(undefined), "₹0.00");
  });

  it("normalizes normal invoice cleanly and excludes PDF or localhost links", () => {
    const normalized = normalizeInvoiceForShare(
      {
        invoiceNumber: "INV-00124",
        date: "10 Nov 2026",
        time: "08:30 PM",
        customer: { name: "Rahul Sharma", phone: "9876543210" },
        items: [{ name: "Basmati Rice 5kg", qty: 2, price: 600, lineTotal: 1200 }],
        subtotal: 1200,
        discount: 0,
        gst: 0,
        grandTotal: 1200,
        paidAmount: 1200,
        balance: 0,
        paymentMethod: "UPI",
        publicToken: "abc123xyz",
        pdfUrl: "http://localhost:8080/invoice/v/abc123xyz/download",
      },
      {
        shopName: "Sharma Kirana Mart",
        address: "12 MG Road, Bengaluru",
        phone: "9845012345",
        gstin: "29ABCDE1234F1Z5",
        thankYouMessage: "Visit again soon!",
      },
    );

    const text = formatWhatsAppInvoiceText(normalized);
    assert.match(text, /Hello Rahul Sharma,/);
    assert.match(text, /Thank you for shopping with Sharma Kirana Mart!/);
    assert.match(text, /Invoice: INV-00124/);
    assert.match(text, /Date: 10 Nov 2026, 08:30 PM/);
    assert.match(text, /Total Amount: ₹1,200\.00/);
    assert.match(text, /Paid: ₹1,200\.00/);
    assert.match(text, /Balance: ₹0\.00/);
    assert.match(text, /Your invoice image is attached\./);
    assert.match(text, /Contact: 9845012345/);
    assert.doesNotMatch(text, /localhost|127\.0\.0\.1|\/download|\/invoice\/v\/|http:\/\//i);
  });

  it("handles discounted + GST bills and partial payments accurately", () => {
    const normalized = normalizeInvoiceForShare({
      invoiceNumber: "INV-00900",
      date: "10 Nov 2026",
      shop: { name: "Apka Mart", phone: "9111222333" },
      customer: { name: "Anita Verma", phone: "+91 91234 56789" },
      items: [
        { name: "Organic Tea", qty: 1, price: 500, discount: 50, lineTotal: 450 },
        { name: "Almond Pack", qty: 2, price: 375, lineTotal: 750 },
      ],
      subtotal: 1250,
      discount: 50,
      gst: 60,
      grandTotal: 1260,
      paidAmount: 500,
      balance: 760,
      paymentMethod: "Cash",
    });

    assert.equal(normalized.items.length, 2);
    assert.equal(normalized.discount, 50);
    assert.equal(normalized.gst, 60);
    assert.equal(normalized.grandTotal, 1260);
    assert.equal(normalized.paidAmount, 500);
    assert.equal(normalized.balance, 760);
    assert.equal(normalized.paymentStatusLabel, "PARTIAL DUE");

    const text = formatWhatsAppInvoiceText(normalized);
    assert.match(text, /Total Amount: ₹1,260\.00/);
    assert.match(text, /Paid: ₹500\.00/);
    assert.match(text, /Balance: ₹760\.00/);
  });

  it("handles missing customer details and optional shop fields safely", () => {
    const normalized = normalizeInvoiceForShare({
      invoiceNumber: "INV-WALKIN",
      customer: { name: "Walk-in Customer", phone: "0000000000" },
      items: [{ name: "Pen Drive 32GB", qty: 1, price: 450, lineTotal: 450 }],
      subtotal: 450,
      grandTotal: 450,
      thankYouMessage: "http://localhost:8080/invoice/v/broken",
    });

    assert.equal(normalized.hasNamedCustomer, false);
    assert.equal(normalized.customerName, "Walk-in Customer");
    assert.equal(normalized.customerPhone, "");
    assert.equal(normalized.thankYouMessage, "Thank you for choosing us!");

    const text = formatWhatsAppInvoiceText(normalized);
    assert.ok(text.startsWith("Hello,\n"));
    assert.doesNotMatch(text, /undefined|null|localhost|0000000000/);
    assert.equal(normalizeWhatsAppPhoneNumber("0000000000"), null);
    for (const p of ["9999999999", "+91 99999 99999", "919999999999"]) assert.equal(normalizeWhatsAppPhoneNumber(p), null, p);
    assert.equal(normalizeWhatsAppPhoneNumber("9919191919"), "919919191919");
    assert.ok(buildWhatsAppDirectUrl(text, "").startsWith("https://wa.me/?text="));
  });

  it("wraps long product names without clipping and paginates long invoices without omitting items", () => {
    const items = Array.from({ length: 75 }, (_, i) => ({
      name:
        i === 0
          ? "SUPERLONGUNBROKENSKUIDENTIFIERNOSPACES12345678901234567890"
          : `Premium Retail Grocery Item #${i + 1} with Extra Descriptive Packaging Variant`,
      qty: (i % 4) + 1,
      price: 120 + i,
      lineTotal: ((i % 4) + 1) * (120 + i),
    }));

    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const normalized = normalizeInvoiceForShare({
      invoiceNumber: "INV-LONG-75",
      date: "10 Nov 2026",
      shop: { name: "Mega Mart Wholesalers" },
      items,
      subtotal,
      grandTotal: subtotal,
    });

    const pages = planInvoiceImagePages(normalized);
    assert.ok(pages.length > 1, "Expected 75 items to split across multiple sequential PNG pages");

    const renderedItemsCount = pages.reduce((sum, p) => sum + p.rows.length, 0);
    assert.equal(renderedItemsCount, 75, "Every single item must be rendered with zero omissions");

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      assert.ok(page.height <= INVOICE_MAX_PAGE_HEIGHT + 40, `Page ${page.pageNumber} height within safe limit`);
      assert.equal(page.isFirstPage, i === 0);
      assert.equal(page.isLastPage, i === pages.length - 1);
    }

    const wrapped = wrapTextForCanvas(items[0].name, 370, (s) => s.length * 10);
    assert.ok(wrapped.length >= 2, "Unspaced long product SKU should wrap across multiple lines instead of clipping");
  });
});

describe("Invoice Share Cross-Platform Coordinator", () => {
  const sampleReceipt = {
    invoiceNumber: "INV-2026-001",
    date: "10 Nov 2026",
    shop: { name: "Apka Mart", phone: "9876543210" },
    customer: { name: "Kiran Patel", phone: "9811122333" },
    items: [{ name: "Sugar 1kg", qty: 2, price: 50, lineTotal: 100 }],
    subtotal: 100,
    grandTotal: 100,
    paidAmount: 100,
    balance: 0,
  };

  it("opens native share sheet on Capacitor Android with generated PNG(s) and INR text", async () => {
    let nativePayload: any = null;
    const result = await shareInvoiceToWhatsApp(sampleReceipt, undefined, {
      isNativeAndroid: () => true,
      generateImages: async (inv) => [
        makeFakeImage(`${inv.invoiceNumber}-page-1.png`, 1, 2),
        makeFakeImage(`${inv.invoiceNumber}-page-2.png`, 2, 2),
      ],
      shareViaNative: async (opts) => {
        nativePayload = opts;
        return { shared: true, fileCount: opts.images.length };
      },
    });

    assert.equal(result.mode, "native_sheet");
    assert.equal(nativePayload.images.length, 2);
    assert.match(nativePayload.text, /Total Amount: ₹100\.00/);
    assert.doesNotMatch(nativePayload.text, /localhost|\/download/);
  });

  it("uses Web Share API with file attachments when supported in mobile browsers", async () => {
    let sharedData: any = null;
    const result = await shareInvoiceToWhatsApp(sampleReceipt, undefined, {
      isNativeAndroid: () => false,
      generateImages: async (inv) => [makeFakeImage(`${inv.invoiceNumber}.png`)],
      canShareFiles: () => true,
      webShare: async (data) => {
        sharedData = data;
      },
    });

    assert.equal(result.mode, "web_share");
    assert.equal(sharedData.files.length, 1);
    assert.equal(sharedData.files[0].type, "image/png");
    assert.match(sharedData.text, /Kiran Patel/);
  });

  it("returns cancelled status gracefully when user dismisses Web Share sheet", async () => {
    let fallbackCalled = false;
    const result = await shareInvoiceToWhatsApp(sampleReceipt, undefined, {
      isNativeAndroid: () => false,
      generateImages: async (inv) => [makeFakeImage(`${inv.invoiceNumber}.png`)],
      canShareFiles: () => true,
      webShare: async () => {
        const err = new Error("User dismissed share sheet");
        err.name = "AbortError";
        throw err;
      },
      downloadImage: () => {
        fallbackCalled = true;
      },
    });

    assert.equal(result.mode, "cancelled");
    assert.equal(fallbackCalled, false);
  });

  it("still offers WhatsApp when Web Share loses activation and the clipboard write hangs", async () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: () => new Promise(() => {}) } },
    });
    try {
      const result = await shareInvoiceToWhatsApp(sampleReceipt, undefined, {
        isNativeAndroid: () => false,
        generateImages: async (inv) => [makeFakeImage(`${inv.invoiceNumber}.png`)],
        canShareFiles: () => true,
        webShare: async () => {
          const err = new Error("Permission denied");
          err.name = "NotAllowedError";
          throw err;
        },
        downloadImage: () => {},
        openWhatsAppUrl: () => false,
      });
      assert.equal(result.mode, "web_fallback");
      assert.equal(result.copiedText, false);
      assert.equal(result.popupBlocked, true);
      assert.ok(result.whatsappUrl?.startsWith("https://wa.me/919811122333?text="));
    } finally {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
    }
  });

  it("desktop: copies the bill image before opening WhatsApp and does not overwrite it with text", async () => {
    const order: string[] = [];
    let copiedBlob: Blob | null = null;
    let textCopied = false;
    const result = await shareInvoiceToWhatsApp(sampleReceipt, undefined, {
      isNativeAndroid: () => false,
      generateImages: async (inv) => [makeFakeImage(`${inv.invoiceNumber}.png`)],
      canShareFiles: () => false,
      copyImage: async (png) => {
        order.push("copyImage");
        copiedBlob = await png;
        return true;
      },
      preOpenWindow: () => {
        order.push("preOpen");
        return { navigate: () => order.push("navigate"), close: () => {} };
      },
      downloadImage: () => {},
      copyText: async () => {
        textCopied = true;
        return true;
      },
    });
    assert.deepEqual(order.slice(0, 2), ["copyImage", "preOpen"]);
    assert.ok(copiedBlob);
    assert.equal(result.imageCopied, true);
    assert.equal(textCopied, false);
    assert.equal(result.copiedText, false);
    assert.match(result.message, /Ctrl\+V/);
    assert.ok(result.whatsappUrl?.startsWith("https://wa.me/919811122333?text="));
  });

  it("falls back to PNG download + text copy + clean wa.me draft when file sharing is unsupported", async () => {
    const downloaded: string[] = [];
    let copied = "";
    let openedUrl = "";

    const result = await shareInvoiceToWhatsApp(sampleReceipt, undefined, {
      isNativeAndroid: () => false,
      generateImages: async (inv) => [makeFakeImage(`${inv.invoiceNumber}.png`)],
      canShareFiles: () => false,
      downloadImage: (img) => downloaded.push(img.filename),
      copyText: async (text) => {
        copied = text;
        return true;
      },
      openWhatsAppUrl: (url) => {
        openedUrl = url;
        return true;
      },
    });

    assert.equal(result.mode, "web_fallback");
    assert.deepEqual(downloaded, ["INV-2026-001.png"]);
    assert.equal(result.copiedText, true);
    assert.match(copied, /Total Amount: ₹100\.00/);
    assert.ok(openedUrl.startsWith("https://wa.me/919811122333?text="));
    const decoded = decodeURIComponent(openedUrl.split("?text=")[1]);
    assert.doesNotMatch(decoded, /localhost|\/download|\/invoice\/v\//);
  });

  it("propagates image generation errors clearly without calling WhatsApp share", async () => {
    let whatsappOpened = false;
    await assert.rejects(
      () =>
        shareInvoiceToWhatsApp(sampleReceipt, undefined, {
          isNativeAndroid: () => false,
          generateImages: async () => {
            throw new Error("Canvas context unavailable");
          },
          openWhatsAppUrl: () => {
            whatsappOpened = true;
            return true;
          },
        }),
      /Canvas context unavailable/,
    );
    assert.equal(whatsappOpened, false);
  });
});

