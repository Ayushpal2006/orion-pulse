import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HtmlRenderer,
  DantsuFormattedRenderer,
  resolveModelLogoSource,
  resolveModelQrUri,
  resolveModelBarcodeValue,
} from "../universal-receipt-renderer";

const sampleModel: any = {
  id: "test-model-1",
  template: "Classic",
  cashierName: "Ramesh",
  business: {
    name: "Shree Ganesh Kirana",
    address: "Station Road, Jaipur",
    phone: "9876543210",
    gstin: "08AABCS1429B1Z1",
    logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  },
  store: {
    name: "Shree Ganesh Kirana",
  },
  invoiceNumber: "INV-2026-9081",
  date: "15/11/2026",
  time: "04:30 PM",
  cashier: "Ramesh",
  customer: {
    name: "Aman Gupta",
    phone: "919811122333",
  },
  items: [
    { name: "Atta 5kg", qty: 1, price: 210, discount: 0, total: 210 },
    { name: "Mustard Oil 1L", qty: 2, price: 145, discount: 0, total: 290 },
  ],
  subtotal: 500,
  discount: 0,
  tax: 0,
  grandTotal: 500,
  payment: {
    method: "UPI",
    upiId: "ganesh@upi",
    upiQrCode: "upi://pay?pa=ganesh@upi&pn=Shree%20Ganesh%20Kirana&am=500.00&cu=INR",
  },
  footer: {
    thankYou: "Dhanyawad! Please visit again.",
  },
};

describe("Thermal Printing Settings & Matrix Verification", () => {
  it("resolves store logo source cleanly and guards against invalid / placeholder sources", () => {
    assert.ok(resolveModelLogoSource(sampleModel)?.startsWith("data:image/png;base64,"));
    assert.equal(resolveModelLogoSource({ business: { logoUrl: "/logo.png" } }), "");
    assert.equal(resolveModelLogoSource({ business: { logoUrl: "" } }), "");
  });

  it("resolves valid UPI payment QR and rejects non-UPI arbitrary URLs", () => {
    const valid = resolveModelQrUri(sampleModel);
    assert.ok(valid?.startsWith("upi://pay?pa=ganesh@upi"));

    const fakeUrlModel = {
      ...sampleModel,
      payment: { method: "UPI", upiQrCode: "https://localhost:8080/invoice/123" },
      metadata: {},
    };
    assert.equal(resolveModelQrUri(fakeUrlModel), "");
  });

  it("resolves printable barcode value and sanitizes non-ASCII characters", () => {
    const code = resolveModelBarcodeValue(sampleModel);
    assert.equal(code, "INV-2026-9081");

    const messyModel = { ...sampleModel, invoiceNumber: "INV 2026\x00\x1F-001" };
    assert.equal(resolveModelBarcodeValue(messyModel), "INV 2026-001");
  });

  it("DantsuFormattedRenderer: includes Logo, QR and Barcode when all toggles are ON", () => {
    const output = DantsuFormattedRenderer.render(sampleModel, {
      paperWidth: "58mm",
      showLogo: true,
      showQr: true,
      showBarcode: true,
    });

    assert.ok(output.includes("[C]<img>"));
    assert.ok(output.includes("<qrcode size='20'>upi://pay?pa=ganesh@upi"));
    assert.ok(output.includes("<barcode type='128'"));
    assert.ok(output.includes("INV-2026-9081"));
  });

  it("DantsuFormattedRenderer: completely omits Store Logo when showLogo is false", () => {
    const output = DantsuFormattedRenderer.render(sampleModel, {
      paperWidth: "58mm",
      showLogo: false,
      showQr: true,
      showBarcode: true,
    });

    assert.ok(!output.includes("[C]<img>"));
    assert.ok(output.includes("<qrcode"));
    assert.ok(output.includes("<barcode"));
  });

  it("DantsuFormattedRenderer: completely omits UPI QR when showQr is false", () => {
    const output = DantsuFormattedRenderer.render(sampleModel, {
      paperWidth: "58mm",
      showLogo: true,
      showQr: false,
      showBarcode: true,
    });

    assert.ok(output.includes("[C]<img>"));
    assert.ok(!output.includes("<qrcode"));
    assert.ok(!output.includes("Scan to Pay via UPI"));
    assert.ok(output.includes("<barcode"));
  });

  it("DantsuFormattedRenderer: completely omits Invoice Barcode when showBarcode is false", () => {
    const output = DantsuFormattedRenderer.render(sampleModel, {
      paperWidth: "58mm",
      showLogo: true,
      showQr: true,
      showBarcode: false,
    });

    assert.ok(output.includes("[C]<img>"));
    assert.ok(output.includes("<qrcode"));
    assert.ok(!output.includes("<barcode"));
  });

  it("DantsuFormattedRenderer: omits all three when all toggles are false", () => {
    const output = DantsuFormattedRenderer.render(sampleModel, {
      paperWidth: "58mm",
      showLogo: false,
      showQr: false,
      showBarcode: false,
    });

    assert.ok(!output.includes("[C]<img>"));
    assert.ok(!output.includes("<qrcode"));
    assert.ok(!output.includes("<barcode"));
    assert.ok(output.includes("Shree Ganesh Kirana"));
    assert.ok(output.includes("GRAND TOTAL"));
  });

  it("HtmlRenderer: generates complete HTML markup with proper paper width", () => {
    const html = HtmlRenderer.render(sampleModel, {
      paperWidth: "58mm",
      showLogo: true,
      showQr: true,
      showBarcode: true,
    });

    assert.ok(html.includes("Shree Ganesh Kirana"));
    assert.ok(html.includes("INV-2026-9081"));
  });
});
