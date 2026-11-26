import React from "react";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { buildUpiUri, isValidUpiUri } from "@/lib/upi";

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  discount?: number;
  gst?: number;
  lineTotal: number;
}

export interface ReceiptData {
  shop: {
    logo?: string;
    name: string;
    address?: string;
    phone?: string;
    gstin?: string;
    upiId?: string;
  };
  invoiceNumber: string;
  date: string;
  time: string;
  cashier: string;
  customer: {
    name: string;
    phone?: string;
    gstin?: string;
  };
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  upiQrCode?: string;
  upiPayload?: string;
  barcodeData?: string;
  thankYouMessage: string;
  invoiceHeader?: string;
  primaryColor?: string;
}

interface TemplateProps {
  receipt: ReceiptData;
  paperWidth?: "58mm" | "80mm" | "A4";
  qrPosition?: "Top" | "Bottom";
  showLogo?: boolean;
  showQr?: boolean;
  showBarcode?: boolean;
}

const formatInr = (val: any) => `₹${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

function resolveValidQrPayload(receipt: ReceiptData): { payload: string; qrImage?: string } {
  const rawPayload = String(receipt.upiPayload || "").trim();
  if (isValidUpiUri(rawPayload)) {
    return { payload: rawPayload, qrImage: receipt.upiQrCode };
  }
  const built = buildUpiUri({
    vpa: receipt.shop?.upiId,
    payeeName: receipt.shop?.name || "Store",
    amountPaise: Math.round((Number(receipt.grandTotal) || 0) * 100),
  });
  if (built) {
    return { payload: built, qrImage: receipt.upiQrCode };
  }
  return { payload: "", qrImage: undefined };
}

function renderQr(receipt: ReceiptData, color = "#000000", size = 110, enabled = true) {
  if (!enabled) return null;
  const resolved = resolveValidQrPayload(receipt);
  if (!resolved.payload && !resolved.qrImage) return null;
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "6px 0" }}
    >
      <div
        style={{
          background: "#ffffff",
          padding: "4px",
          border: `1px solid ${color}`,
          borderRadius: "4px",
          display: "inline-block",
        }}
      >
        {resolved.qrImage ? (
          <img
            src={resolved.qrImage}
            style={{ width: `${size}px`, height: `${size}px`, display: "block" }}
            alt="UPI QR Code"
          />
        ) : (
          <QRCodeSVG value={resolved.payload} size={size} />
        )}
      </div>
      <span style={{ fontSize: "8px", color, fontWeight: "bold", marginTop: "2px" }}>
        Scan to Pay via UPI
      </span>
    </div>
  );
}

/**
 * Pure SSR-safe CODE128 vector SVG barcode rendered via JsBarcode encoder.
 */
export function ReceiptBarcode({
  value,
  enabled = true,
  compact = false,
}: {
  value?: string;
  enabled?: boolean;
  compact?: boolean;
}) {
  if (!enabled) return null;
  const clean = String(value || "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 32);
  if (!clean) return null;

  let bitString = "";
  try {
    const out: any = {};
    JsBarcode(out, clean, { format: "CODE128" });
    bitString = String(out.encodings?.[0]?.data || "");
  } catch {
    return null;
  }
  if (!bitString) return null;

  const rects: { x: number; w: number }[] = [];
  let i = 0;
  while (i < bitString.length) {
    if (bitString[i] === "1") {
      const start = i;
      while (i < bitString.length && bitString[i] === "1") i++;
      rects.push({ x: start + 8, w: i - start });
    } else {
      i++;
    }
  }
  const totalWidth = bitString.length + 16;
  const height = compact ? 28 : 36;

  return (
    <div
      data-receipt-barcode={clean}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        margin: "6px 0 4px",
      }}
    >
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        style={{
          width: "100%",
          maxWidth: compact ? "168px" : "210px",
          height: `${height}px`,
          background: "#ffffff",
          display: "block",
        }}
        role="img"
        aria-label={`Invoice Barcode ${clean}`}
      >
        <rect x="0" y="0" width={totalWidth} height={height} fill="#ffffff" />
        {rects.map((r, idx) => (
          <rect key={idx} x={r.x} y={2} width={r.w} height={height - 4} fill="#000000" />
        ))}
      </svg>
      <span
        style={{
          fontSize: "7.5px",
          fontFamily: "monospace",
          letterSpacing: "0.08em",
          color: "#111111",
          marginTop: "2px",
        }}
      >
        {clean}
      </span>
    </div>
  );
}

// =========================================================
// 1. CLASSIC TEMPLATE (80mm) — MATCH REFERENCE SCREENSHOT 1
// =========================================================
export function ClassicTemplate({
  receipt,
  qrPosition = "Bottom",
  showLogo = true,
  showQr = true,
  showBarcode = true,
}: TemplateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        fontSize: "10px",
        fontFamily: "'Inter', sans-serif",
        color: "#000000",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          marginBottom: "4px",
        }}
      >
        {showLogo && receipt.shop.logo && (
          <img
            src={receipt.shop.logo}
            alt="Logo"
            style={{
              maxWidth: "140px",
              maxHeight: "42px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              marginBottom: "4px",
            }}
          />
        )}
        <div style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase" }}>
          {receipt.shop.name}
        </div>
        {receipt.shop.address && (
          <div style={{ fontSize: "8px", color: "#333", marginTop: "2px", maxWidth: "90%" }}>
            {receipt.shop.address}
          </div>
        )}
        {receipt.shop.phone && (
          <div style={{ fontSize: "8px", color: "#333", marginTop: "1px" }}>
            PH: {receipt.shop.phone}
          </div>
        )}
        {receipt.shop.gstin && (
          <div style={{ fontSize: "8px", color: "#333", marginTop: "1px" }}>
            GSTIN: {receipt.shop.gstin}
          </div>
        )}
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      <div style={{ fontSize: "8.5px", lineHeight: "1.3" }}>
        <div>
          <strong>INV :</strong> {receipt.invoiceNumber}
        </div>
        <div>
          <strong>DATE :</strong> {receipt.date}
        </div>
        <div>
          <strong>TIME :</strong> {receipt.time}
        </div>
        <div>
          <strong>CASH :</strong> {receipt.cashier}
        </div>
        <div>
          <strong>CUST :</strong> {receipt.customer.name}
        </div>
        {receipt.customer.phone && (
          <div>
            <strong>PHONE:</strong> +91 {receipt.customer.phone}
          </div>
        )}
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      {qrPosition === "Top" && renderQr(receipt, "#000000", 110, showQr)}

      <table
        style={{ width: "100%", fontSize: "8.5px", borderCollapse: "collapse", margin: "2px 0" }}
      >
        <thead>
          <tr style={{ borderBottom: "1px dashed #000000" }}>
            <th align="left" style={{ paddingBottom: "2px", fontWeight: "bold" }}>
              Item
            </th>
            <th align="right" style={{ paddingBottom: "2px", fontWeight: "bold" }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: "2px 0" }}>
                {item.qty}x {item.name}
              </td>
              <td align="right" style={{ padding: "2px 0" }}>
                {formatInr(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "8.5px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span>
          <span>{formatInr(receipt.subtotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Discount</span>
          <span>-{formatInr(receipt.discount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>GST Tax</span>
          <span>{formatInr(receipt.gst)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            fontWeight: "bold",
            marginTop: "2px",
          }}
        >
          <span>GRAND TOTAL</span>
          <span>{formatInr(receipt.grandTotal)}</span>
        </div>
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      <div style={{ textAlign: "center", margin: "4px 0" }}>
        <div style={{ fontSize: "8.5px", fontWeight: "bold" }}>
          Paid via {receipt.paymentMethod}
        </div>
        {qrPosition === "Bottom" && renderQr(receipt, "#000000", 110, showQr)}
      </div>

      <ReceiptBarcode value={receipt.barcodeData || receipt.invoiceNumber} enabled={showBarcode} />

      <div style={{ fontSize: "7.5px", textAlign: "center", color: "#444", marginTop: "4px" }}>
        {receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt."}
      </div>
    </div>
  );
}

// =========================================================
// 2. MODERN TEMPLATE (80mm) — MATCH REFERENCE SCREENSHOT 2
// =========================================================
export function ModernTemplate({
  receipt,
  qrPosition = "Bottom",
  showLogo = true,
  showQr = true,
  showBarcode = true,
}: TemplateProps) {
  const primary = receipt.primaryColor || "#2563eb";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        fontSize: "10px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Blue Header Banner */}
      <div
        style={{
          background: primary,
          borderRadius: "6px 6px 0 0",
          padding: "10px",
          textAlign: "center",
          color: "#ffffff",
          marginBottom: "6px",
        }}
      >
        {receipt.shop.logo && (
          <img
            src={receipt.shop.logo}
            alt="Logo"
            style={{
              maxHeight: "32px",
              objectFit: "contain",
              background: "#ffffff",
              padding: "2px",
              borderRadius: "4px",
              marginBottom: "4px",
            }}
          />
        )}
        <div
          style={{
            fontSize: "14px",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {receipt.shop.name}
        </div>
        {receipt.shop.address && (
          <div style={{ fontSize: "7.5px", opacity: 0.9, marginTop: "2px" }}>
            {receipt.shop.address}
          </div>
        )}
        {(receipt.shop.phone || receipt.shop.gstin) && (
          <div style={{ fontSize: "7.5px", opacity: 0.9 }}>
            {[
              receipt.shop.phone ? `Ph: ${receipt.shop.phone}` : "",
              receipt.shop.gstin ? `GSTIN: ${receipt.shop.gstin}` : "",
            ]
              .filter(Boolean)
              .join(" | ")}
          </div>
        )}
      </div>

      {/* Metadata Grey Grid */}
      <div
        style={{
          background: "#f1f5f9",
          padding: "6px 8px",
          borderRadius: "4px",
          fontSize: "8px",
          border: "1px solid #e2e8f0",
          marginBottom: "6px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>
            <strong>Invoice #:</strong> {receipt.invoiceNumber}
          </span>
          <span>
            <strong>Date:</strong> {receipt.date}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
          <span>
            <strong>Customer:</strong> {receipt.customer.name}
          </span>
          <span>
            <strong>Cashier:</strong> {receipt.cashier}
          </span>
        </div>
      </div>

      {qrPosition === "Top" && renderQr(receipt, primary, 110, showQr)}

      {/* Item Table with Blue Header */}
      <table
        style={{
          width: "100%",
          fontSize: "8.5px",
          borderCollapse: "collapse",
          marginBottom: "6px",
        }}
      >
        <thead>
          <tr style={{ background: primary, color: "#ffffff" }}>
            <th align="left" style={{ padding: "4px 6px" }}>
              Item Description
            </th>
            <th align="center" style={{ padding: "4px 6px" }}>
              Qty
            </th>
            <th align="right" style={{ padding: "4px 6px" }}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
              <td style={{ padding: "4px 6px" }}>{item.name}</td>
              <td align="center" style={{ padding: "4px 6px" }}>
                {item.qty}
              </td>
              <td align="right" style={{ padding: "4px 6px" }}>
                {formatInr(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Block */}
      <div
        style={{
          background: "#f8fafc",
          padding: "6px 8px",
          borderRadius: "4px",
          fontSize: "8.5px",
          border: "1px solid #e2e8f0",
          marginBottom: "6px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal:</span>
          <span>{formatInr(receipt.subtotal)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#dc2626",
            marginTop: "2px",
          }}
        >
          <span>Discount:</span>
          <span>-{formatInr(receipt.discount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
          <span>Tax:</span>
          <span>{formatInr(receipt.gst)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            fontWeight: "bold",
            color: primary,
            marginTop: "4px",
            paddingTop: "4px",
            borderTop: `1px solid ${primary}`,
          }}
        >
          <span>GRAND TOTAL:</span>
          <span>{formatInr(receipt.grandTotal)}</span>
        </div>
      </div>

      <div style={{ textAlign: "center", margin: "4px 0" }}>
        <div style={{ fontSize: "8.5px", fontWeight: "bold", color: primary }}>
          Paid via {receipt.paymentMethod}
        </div>
        {qrPosition === "Bottom" && renderQr(receipt, primary, 110, showQr)}
      </div>

      <ReceiptBarcode value={receipt.barcodeData || receipt.invoiceNumber} enabled={showBarcode} />

      <div style={{ fontSize: "7.5px", textAlign: "center", color: "#64748b" }}>
        {receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt."}
      </div>
    </div>
  );
}

// =========================================================
// 3. MINIMAL TEMPLATE (80mm) — MATCH REFERENCE SCREENSHOT 3
// =========================================================
export function MinimalTemplate({
  receipt,
  qrPosition = "Bottom",
  showLogo = true,
  showQr = true,
  showBarcode = true,
}: TemplateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        fontSize: "9px",
        fontFamily: "monospace",
        color: "#000000",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        {showLogo && receipt.shop.logo && (
          <img
            src={receipt.shop.logo}
            alt="Logo"
            style={{
              maxWidth: "120px",
              maxHeight: "34px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              margin: "0 auto 4px",
            }}
          />
        )}
        <div style={{ fontSize: "12px", fontWeight: "bold" }}>{receipt.shop.name}</div>
        <div style={{ fontSize: "8px", color: "#555" }}>
          {receipt.shop.phone || "-"} | GST: {receipt.shop.gstin || "-"}
        </div>
      </div>
      <div style={{ borderTop: "1px solid #ccc", margin: "4px 0" }}></div>

      <div style={{ fontSize: "8px" }}>
        Inv: {receipt.invoiceNumber} {receipt.date}
      </div>
      <div style={{ borderTop: "1px solid #ccc", margin: "4px 0" }}></div>

      {qrPosition === "Top" && renderQr(receipt, "#000000", 90, showQr)}

      <table
        style={{ width: "100%", fontSize: "8.5px", borderCollapse: "collapse", margin: "2px 0" }}
      >
        <tbody>
          {receipt.items.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: "2px 0" }}>
                {item.qty}x {item.name}
              </td>
              <td align="right" style={{ padding: "2px 0" }}>
                {formatInr(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px solid #ccc", margin: "4px 0" }}></div>

      <div style={{ fontSize: "10px", fontWeight: "bold" }}>
        TOTAL:{formatInr(receipt.grandTotal)}
      </div>

      <div style={{ textAlign: "center", margin: "4px 0" }}>
        <div style={{ fontSize: "8px" }}>Paid via {receipt.paymentMethod}</div>
        {qrPosition === "Bottom" && renderQr(receipt, "#000000", 90, showQr)}
      </div>

      <ReceiptBarcode value={receipt.barcodeData || receipt.invoiceNumber} enabled={showBarcode} />

      <div style={{ fontSize: "7px", textAlign: "center", color: "#666", marginTop: "4px" }}>
        {receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt."}
      </div>
    </div>
  );
}

// =========================================================
// 4. RETAIL TEMPLATE (80mm) — MATCH REFERENCE SCREENSHOT 4
// =========================================================
export function RetailTemplate({
  receipt,
  qrPosition = "Bottom",
  showLogo = true,
  showQr = true,
  showBarcode = true,
}: TemplateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        fontSize: "9.5px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          marginBottom: "4px",
        }}
      >
        {showLogo && receipt.shop.logo && (
          <img
            src={receipt.shop.logo}
            alt="Logo"
            style={{
              maxWidth: "140px",
              maxHeight: "42px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              marginBottom: "4px",
            }}
          />
        )}
        <div style={{ fontSize: "13px", fontWeight: "bold" }}>{receipt.shop.name}</div>
        {receipt.shop.address && (
          <div style={{ fontSize: "7.5px", color: "#444" }}>{receipt.shop.address}</div>
        )}
        {receipt.shop.phone && (
          <div style={{ fontSize: "7.5px", color: "#444" }}>PH: {receipt.shop.phone}</div>
        )}
        {receipt.shop.gstin && (
          <div style={{ fontSize: "7.5px", color: "#444" }}>GSTIN: {receipt.shop.gstin}</div>
        )}
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      <div style={{ fontSize: "8px", lineHeight: "1.3" }}>
        <div>
          <strong>INV :</strong> {receipt.invoiceNumber}
        </div>
        <div>
          <strong>DATE :</strong> {receipt.date}
        </div>
        <div>
          <strong>TIME :</strong> {receipt.time}
        </div>
        <div>
          <strong>CASH :</strong> {receipt.cashier}
        </div>
        <div>
          <strong>CUST :</strong> {receipt.customer.name}
        </div>
        {receipt.customer.phone && (
          <div>
            <strong>PHONE:</strong> +91 {receipt.customer.phone}
          </div>
        )}
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      {qrPosition === "Top" && renderQr(receipt, "#000000", 110, showQr)}

      <div style={{ width: "100%", margin: "2px 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "8.5px",
            fontWeight: "bold",
            borderBottom: "1px dashed #000",
            paddingBottom: "2px",
          }}
        >
          <span>#</span>
          <span>Item Name</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "8px",
            fontWeight: "bold",
            borderBottom: "1px dashed #000",
            paddingBottom: "2px",
          }}
        >
          <span>Qty</span>
          <span>Price</span>
          <span>Amount</span>
        </div>

        {receipt.items.map((item, i) => (
          <div
            key={i}
            style={{ borderBottom: "1px dotted #ccc", padding: "3px 0", fontSize: "8px" }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <span>{i + 1}</span>
              <span style={{ fontWeight: "bold" }}>{item.name}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#333",
                marginTop: "1px",
              }}
            >
              <span>{item.qty}</span>
              <span>{formatInr(item.price)}</span>
              <span style={{ fontWeight: "bold" }}>{formatInr(item.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span>
          <span>{formatInr(receipt.subtotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Discount</span>
          <span>-{formatInr(receipt.discount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>GST Tax</span>
          <span>{formatInr(receipt.gst)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            fontWeight: "bold",
            marginTop: "2px",
          }}
        >
          <span>GRAND TOTAL</span>
          <span>{formatInr(receipt.grandTotal)}</span>
        </div>
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      <div style={{ textAlign: "center", margin: "4px 0" }}>
        <div style={{ fontSize: "8px", fontWeight: "bold" }}>
          Paid via {receipt.paymentMethod}
        </div>
        {qrPosition === "Bottom" && renderQr(receipt, "#000000", 110, showQr)}
      </div>

      <ReceiptBarcode value={receipt.barcodeData || receipt.invoiceNumber} enabled={showBarcode} />

      <div style={{ fontSize: "7px", textAlign: "center", color: "#444" }}>
        {receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt."}
      </div>
    </div>
  );
}

// =========================================================
// 5. WHOLESALE TEMPLATE (A4) — MATCH REFERENCE SCREENSHOT 5
// =========================================================
export function WholesaleTemplate({
  receipt,
  qrPosition = "Bottom",
  showLogo = true,
  showQr = true,
  showBarcode = true,
}: TemplateProps) {
  const primary = receipt.primaryColor || "#047857"; // Emerald Green
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        border: `2px solid ${primary}`,
        padding: "16px",
        boxSizing: "border-box",
        fontSize: "11px",
        fontFamily: "'Inter', sans-serif",
        background: "#ffffff",
      }}
    >
      {/* Top Header Title */}
      {showLogo && receipt.shop.logo && (
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <img
            src={receipt.shop.logo}
            alt="Logo"
            style={{
              maxWidth: "160px",
              maxHeight: "48px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              margin: "0 auto",
            }}
          />
        </div>
      )}
      <div
        style={{
          textAlign: "center",
          color: primary,
          fontWeight: "bold",
          fontSize: "14px",
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}
      >
        TAX INVOICE
      </div>
      <div style={{ textAlign: "center", fontSize: "18px", fontWeight: "bold", margin: "4px 0" }}>
        {receipt.shop.name}
      </div>
      <div style={{ textAlign: "center", fontSize: "9px", color: "#475569", marginBottom: "6px" }}>
        {receipt.shop.address}
      </div>

      {/* Green Banner Bar */}
      {(receipt.shop.gstin || receipt.shop.phone) && (
        <div
          style={{
            background: primary,
            color: "#ffffff",
            padding: "4px",
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "9.5px",
            borderRadius: "2px",
            marginBottom: "10px",
          }}
        >
          {[
            receipt.shop.gstin ? `GSTIN: ${receipt.shop.gstin}` : "",
            receipt.shop.phone ? `PH: ${receipt.shop.phone}` : "",
          ]
            .filter(Boolean)
            .join(" | ")}
        </div>
      )}

      {/* 2-Column Info Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            border: `1px solid ${primary}`,
            padding: "6px",
            borderRadius: "2px",
            fontSize: "9px",
          }}
        >
          <div style={{ fontWeight: "bold", color: primary, marginBottom: "2px" }}>
            DETAILS OF RECEIVER / BUYER
          </div>
          <div>
            <strong>Name:</strong> {receipt.customer.name}
          </div>
          <div>
            <strong>Phone:</strong> +91 {receipt.customer.phone || "-"}
          </div>
        </div>
        <div
          style={{
            border: `1px solid ${primary}`,
            padding: "6px",
            borderRadius: "2px",
            fontSize: "9px",
          }}
        >
          <div style={{ fontWeight: "bold", color: primary, marginBottom: "2px" }}>
            INVOICE SPECIFICATION
          </div>
          <div>
            <strong>Invoice No:</strong> {receipt.invoiceNumber}
          </div>
          <div>
            <strong>Date & Time:</strong> {receipt.date} {receipt.time}
          </div>
          <div>
            <strong>Cashier:</strong> {receipt.cashier}
          </div>
        </div>
      </div>

      {/* Item Table */}
      <table
        style={{
          width: "100%",
          fontSize: "9.5px",
          borderCollapse: "collapse",
          marginBottom: "10px",
        }}
      >
        <thead>
          <tr style={{ background: primary, color: "#ffffff" }}>
            <th align="left" style={{ padding: "6px" }}>
              Item Description
            </th>
            <th align="center" style={{ padding: "6px" }}>
              Qty
            </th>
            <th align="right" style={{ padding: "6px" }}>
              Rate
            </th>
            <th align="right" style={{ padding: "6px" }}>
              Tax %
            </th>
            <th align="right" style={{ padding: "6px" }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "5px 6px" }}>{item.name}</td>
              <td align="center" style={{ padding: "5px 6px" }}>
                {item.qty}
              </td>
              <td align="right" style={{ padding: "5px 6px" }}>
                {formatInr(item.price)}
              </td>
              <td align="right" style={{ padding: "5px 6px" }}>
                {item.gst || 0}%
              </td>
              <td align="right" style={{ padding: "5px 6px" }}>
                {formatInr(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom Summary 2-Panel Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            border: "1px solid #cbd5e1",
            padding: "6px",
            fontSize: "8.5px",
            borderRadius: "2px",
          }}
        >
          <div style={{ fontWeight: "bold", color: primary, marginBottom: "2px" }}>TAX SUMMARY</div>
          <div>Taxable Amount: {formatInr(receipt.subtotal - receipt.discount)}</div>
          <div>CGST + SGST (GST): {formatInr(receipt.gst)}</div>
          <div style={{ color: "#64748b", marginTop: "4px", fontSize: "7.5px" }}>
            Tax Invoice issued under GST Rules.
          </div>
        </div>
        <div
          style={{
            border: `1px solid ${primary}`,
            background: "#f0fdf4",
            padding: "6px",
            fontSize: "9px",
            borderRadius: "2px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal:</span>
            <span>{formatInr(receipt.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
            <span>Discount:</span>
            <span>-{formatInr(receipt.discount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Total Tax:</span>
            <span>{formatInr(receipt.gst)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              fontWeight: "bold",
              color: primary,
              marginTop: "4px",
              paddingTop: "4px",
              borderTop: `1px solid ${primary}`,
            }}
          >
            <span>GRAND TOTAL:</span>
            <span>{formatInr(receipt.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Footer Signature & QR Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "end",
          gap: "10px",
          marginTop: "auto",
        }}
      >
        <div>
          {showQr && renderQr(receipt, primary, 85, showQr)}
          <div style={{ fontSize: "8px", fontWeight: "bold", color: primary }}>
            Paid via {receipt.paymentMethod}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "8.5px", fontWeight: "bold", color: primary }}>
            FOR {receipt.shop.name.toUpperCase()}
          </div>
          <div style={{ height: "30px" }}></div>
          <div
            style={{
              borderTop: "1px solid #94a3b8",
              fontSize: "8px",
              color: "#64748b",
              paddingTop: "2px",
            }}
          >
            Authorized Signatory
          </div>
        </div>
      </div>

      <ReceiptBarcode value={receipt.barcodeData || receipt.invoiceNumber} enabled={showBarcode} />

      <div style={{ fontSize: "7.5px", textAlign: "center", color: "#64748b", marginTop: "10px" }}>
        {receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt."}
      </div>
    </div>
  );
}

// 6. GST PROFESSIONAL TEMPLATE (A4)
export function GstProfessionalTemplate(props: TemplateProps) {
  return <WholesaleTemplate {...props} />;
}

// 7. RESTAURANT TEMPLATE (80mm)
export function RestaurantTemplate(props: TemplateProps) {
  return <ClassicTemplate {...props} />;
}

// 8. MEDICAL TEMPLATE (80mm)
export function MedicalTemplate(props: TemplateProps) {
  return <ClassicTemplate {...props} />;
}

// 9. FASHION TEMPLATE (80mm)
export function FashionTemplate(props: TemplateProps) {
  return <ClassicTemplate {...props} />;
}

// =========================================================
// 10. COMPACT TEMPLATE (58mm) — MATCH REFERENCE SCREENSHOT 11
// =========================================================
export function CompactTemplate({
  receipt,
  qrPosition = "Bottom",
  showLogo = true,
  showQr = true,
  showBarcode = true,
}: TemplateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        fontSize: "8.5px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "2px" }}>
        {showLogo && receipt.shop.logo && (
          <img
            src={receipt.shop.logo}
            alt="Logo"
            style={{
              maxWidth: "120px",
              maxHeight: "34px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              margin: "0 auto 3px",
            }}
          />
        )}
        <div style={{ fontSize: "11px", fontWeight: "bold" }}>{receipt.shop.name}</div>
        <div style={{ fontSize: "7.5px", color: "#444" }}>
          {receipt.shop.phone || "-"} | GST:{receipt.shop.gstin || "-"}
        </div>
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "3px 0" }}></div>

      <div style={{ fontSize: "7.5px", lineHeight: "1.2" }}>
        <div>INV: {receipt.invoiceNumber}</div>
        <div>
          DAT: {receipt.date} {receipt.time}
        </div>
        <div>CUST: {receipt.customer.name}</div>
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "3px 0" }}></div>

      <div style={{ margin: "2px 0" }}>
        {receipt.items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "1px 0",
              fontSize: "7.5px",
            }}
          >
            <span>
              {item.qty}x {item.name}
            </span>
            <span>{formatInr(item.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "3px 0" }}></div>

      <div style={{ fontSize: "7.5px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Sub / GST</span>
          <span>
            {formatInr(receipt.subtotal)} / {formatInr(receipt.gst)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Discount</span>
          <span>-{formatInr(receipt.discount)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10px",
            fontWeight: "bold",
            marginTop: "2px",
          }}
        >
          <span>TOTAL</span>
          <span>{formatInr(receipt.grandTotal)}</span>
        </div>
      </div>
      <div style={{ borderTop: "1px dashed #000000", margin: "3px 0" }}></div>

      {showQr && (
        <div style={{ textAlign: "center", margin: "3px 0" }}>
          {renderQr(receipt, "#000000", 86, showQr)}
        </div>
      )}

      <ReceiptBarcode
        value={receipt.barcodeData || receipt.invoiceNumber}
        enabled={showBarcode}
        compact
      />

      <div style={{ fontSize: "7px", textAlign: "center", color: "#444" }}>
        Paid: {receipt.paymentMethod}
        <br />
        {receipt.thankYouMessage || "Goods once sold cannot be returned without original receipt."}
      </div>
    </div>
  );
}

// 11. THERMAL TEMPLATE (80mm)
export function ThermalTemplate(props: TemplateProps) {
  return <ClassicTemplate {...props} />;
}

// CANONICAL TEMPLATE DISPATCHER
export interface ReceiptRendererProps {
  templateName?: string;
  template?: string;
  receipt: ReceiptData;
  qrPosition?: "Top" | "Bottom";
  paperWidth?: "58mm" | "80mm" | "A4";
  showLogo?: boolean;
  showQr?: boolean;
  showBarcode?: boolean;
}

export function ReceiptRenderer({
  templateName,
  template,
  receipt,
  qrPosition = "Bottom",
  paperWidth,
  showLogo = true,
  showQr = true,
  showBarcode = true,
}: ReceiptRendererProps) {
  const t = String(templateName || template || "Classic").trim();
  const shared = { receipt, qrPosition, paperWidth, showLogo, showQr, showBarcode };
  if (t === "Modern") return <ModernTemplate {...shared} />;
  if (t === "Minimal") return <MinimalTemplate {...shared} />;
  if (t === "Retail") return <RetailTemplate {...shared} />;
  if (t === "Wholesale") return <WholesaleTemplate {...shared} />;
  if (t === "GST Professional") return <GstProfessionalTemplate {...shared} />;
  if (t === "Restaurant") return <RestaurantTemplate {...shared} />;
  if (t === "Medical") return <MedicalTemplate {...shared} />;
  if (t === "Fashion") return <FashionTemplate {...shared} />;
  if (t === "Compact") return <CompactTemplate {...shared} />;
  if (t === "Thermal") return <ThermalTemplate {...shared} />;
  return <ClassicTemplate {...shared} />;
}
