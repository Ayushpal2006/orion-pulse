import { describe, it } from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { buildUpiUri, isValidUpiUri, normalizeVpa } from "../upi";
import * as backendUpi from "../../../../backend/src/utils/upi";

describe("UPI URI + QR", () => {
  it("formats ₹1,200 (120000 paise) exactly once as am=1200.00", () => {
    const uri = buildUpiUri({ vpa: "shop@okaxis", payeeName: "Apka Mart", amountPaise: 120000 });
    assert.equal(uri, "upi://pay?pa=shop@okaxis&pn=Apka%20Mart&am=1200.00&cu=INR");
    assert.ok(isValidUpiUri(uri));
  });

  it("never builds a QR payload for a missing or invalid VPA", () => {
    for (const vpa of ["", null, "not-a-vpa", "a@", "@bank", "x y@bank"]) {
      assert.equal(buildUpiUri({ vpa, payeeName: "S", amountPaise: 100 }), "");
      assert.equal(normalizeVpa(vpa), null);
    }
    assert.equal(isValidUpiUri("https://evil.example/pay"), false);
  });

  it("frontend and backend builders produce identical URIs", () => {
    for (const amountPaise of [undefined, 0, 1, 50000, 120000, 123456]) {
      const opts = { vpa: "store.name@ybl", payeeName: "Ganesh Kirana & Sons", amountPaise };
      assert.equal(buildUpiUri(opts), backendUpi.buildUpiUri(opts));
    }
  });

  it("payload is encodable as a QR code", async () => {
    const uri = buildUpiUri({ vpa: "shop@okaxis", payeeName: "Apka Mart", amountPaise: 120000 });
    const qr = QRCode.create(uri, { errorCorrectionLevel: "M" });
    assert.ok(qr.modules.size >= 21);
    assert.match(await QRCode.toDataURL(uri), /^data:image\/png;base64,/);
  });
});
