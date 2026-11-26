import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ShareService, normalizeWhatsAppPhone } from "../services/share.service";

describe("Backend ShareService WhatsApp formatting (PDF links paused)", () => {
  const shareService = new ShareService();

  it("formats INR invoice summary without any localhost or PDF links", () => {
    const receipt = {
      invoiceNumber: "INV-00124",
      date: "10 Nov 2026",
      time: "06:15 PM",
      branding: {
        shopName: "Apka Bill Mart",
        phone: "9876543210",
      },
      customer: {
        name: "Rahul Sharma",
        phone: "9123456789",
      },
      grandTotal: 1200,
      paidAmount: 500,
      balance: 700,
      publicToken: "tok123456",
    };

    const message = shareService.generateWhatsAppMessage(receipt);
    assert.match(message, /Hello Rahul Sharma,/);
    assert.match(message, /Thank you for shopping with Apka Bill Mart!/);
    assert.match(message, /Invoice: INV-00124/);
    assert.match(message, /Total Amount: ₹1,200\.00/);
    assert.match(message, /Paid: ₹500\.00/);
    assert.match(message, /Balance: ₹700\.00/);
    assert.match(message, /Your invoice image is attached\./);
    assert.doesNotMatch(message, /localhost|127\.0\.0\.1|\/download|\/invoice\/v\/|http:\/\//i);

    const url = shareService.generateWhatsAppLink(receipt);
    assert.ok(url.startsWith("https://wa.me/919123456789?text="));
    const decoded = decodeURIComponent(url.split("?text=")[1]);
    assert.doesNotMatch(decoded, /localhost|\/download|\/invoice\/v\//);
  });

  it("safely handles walk-in/missing customer name & legacy settled bills", () => {
    const message = shareService.generateWhatsAppMessage({
      invoiceNumber: "INV-00200",
      shop: { name: "Corner Store" },
      customer: { name: "Walk-in Customer", phone: "" },
      grandTotal: 2500,
    });

    assert.ok(message.startsWith("Hello,\n"));
    assert.match(message, /Total Amount: ₹2,500\.00/);
    assert.match(message, /Paid: ₹2,500\.00/);
    assert.match(message, /Balance: ₹0\.00/);
    assert.doesNotMatch(message, /localhost|undefined/);
  });

  it("normalizes Indian phone numbers and blocks empty/dummy numbers in generateWhatsAppLink", () => {
    assert.equal(normalizeWhatsAppPhone("9876543210"), "919876543210");
    assert.equal(normalizeWhatsAppPhone("0000000000"), null);
    for (const p of ["9999999999", "+91 99999 99999", "919999999999", "1111111111"]) assert.equal(normalizeWhatsAppPhone(p), null, p);
    assert.equal(normalizeWhatsAppPhone("9919191919"), "919919191919");
    assert.throws(
      () =>
        shareService.generateWhatsAppLink({
          invoiceNumber: "INV-1",
          customer: { name: "Walk-in", phone: "0000000000" },
          grandTotal: 100,
        }),
      /Customer phone number is required/,
    );
  });
});

