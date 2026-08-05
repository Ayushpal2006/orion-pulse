import React from "react";
import { QRCodeSVG } from "qrcode.react";

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
  };
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  upiQrCode?: string;
  upiPayload?: string;
  thankYouMessage: string;
}

interface TemplateProps {
  receipt: ReceiptData;
  paperWidth: "58mm" | "80mm";
  qrPosition: "Top" | "Bottom";
}

export function ClassicTemplate({ receipt, qrPosition }: TemplateProps) {
const formatInr = (val: any) => `₹${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

  const qr = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "6px 0" }}>
      <div style={{ background: "#ffffff", padding: "6px", border: "1px solid #dddddd", display: "inline-block", marginBottom: "2px" }}>
        {receipt.upiQrCode ? (
          <img src={receipt.upiQrCode} style={{ width: "130px", height: "130px", display: "block" }} alt="UPI QR Code" />
        ) : (
          <QRCodeSVG value={receipt.upiPayload || ""} size={130} />
        )}
      </div>
      <span style={{ fontSize: "8px", color: "#555555", fontWeight: "bold" }}>Scan to Pay via UPI</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
      {/* Shop Info Header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "6px" }}>
        {receipt.shop.logo && (
          <img src={receipt.shop.logo} alt="Store Logo" style={{ maxHeight: "36px", objectFit: "contain", marginBottom: "6px" }} />
        )}
        <div style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "2px", lineHeight: "1.1" }}>
          {receipt.shop.name}
        </div>
        <div style={{ fontSize: "10px", color: "#333333", marginBottom: "1px" }}>{receipt.shop.address}</div>
        <div style={{ fontSize: "10px", color: "#333333", marginBottom: "1px" }}>PH: {receipt.shop.phone}</div>
        <div style={{ fontSize: "10px", color: "#333333" }}>GSTIN: {receipt.shop.gstin}</div>
      </div>

      <div style={{ borderTop: "1px dashed #000000", margin: "6px 0", width: "100%" }}></div>

      {/* Invoice Info */}
      <div style={{ fontSize: "10px", lineHeight: "1.35", textAlign: "left", margin: "4px 0" }}>
        <div><strong>INV  :</strong> {receipt.invoiceNumber}</div>
        <div><strong>DATE :</strong> {receipt.date}</div>
        <div><strong>TIME :</strong> {receipt.time}</div>
        <div><strong>CASH :</strong> {receipt.cashier}</div>
        <div><strong>CUST :</strong> {receipt.customer.name}</div>
        {receipt.customer.phone && <div><strong>PHONE:</strong> +91 {receipt.customer.phone}</div>}
      </div>

      <div style={{ borderTop: "1px dashed #000000", margin: "6px 0", width: "100%" }}></div>

      {qrPosition === "Top" && receipt.paymentMethod === "UPI" && qr}

      {/* Items List Table */}
      <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse", margin: "4px 0" }}>
        <thead>
          <tr style={{ borderBottom: "1px dashed #000000" }}>
            <th align="left" style={{ paddingBottom: "3px", fontWeight: "bold" }}>Item</th>
            <th align="right" style={{ paddingBottom: "3px", fontWeight: "bold" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={idx} style={{ verticalAlign: "top" }}>
              <td style={{ padding: "3px 0", textAlign: "left", paddingRight: "4px" }}>
                {item.qty}x {item.name}
              </td>
              <td align="right" style={{ padding: "3px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                {formatInr(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000000", margin: "6px 0", width: "100%" }}></div>

      {/* Totals Summary */}
      <table style={{ width: "100%", fontSize: "10px", lineHeight: "1.35", margin: "4px 0" }}>
        <tbody>
          <tr>
            <td style={{ textAlign: "left", padding: "2px 0" }}>Subtotal</td>
            <td style={{ textAlign: "right", padding: "2px 0" }}>{formatInr(receipt.subtotal)}</td>
          </tr>
          {receipt.discount > 0 && (
            <tr>
              <td style={{ textAlign: "left", padding: "2px 0" }}>Discount</td>
              <td style={{ textAlign: "right", padding: "2px 0" }}>-{formatInr(receipt.discount)}</td>
            </tr>
          )}
          <tr>
            <td style={{ textAlign: "left", padding: "2px 0" }}>GST Tax</td>
            <td style={{ textAlign: "right", padding: "2px 0" }}>{formatInr(receipt.gst)}</td>
          </tr>
          <tr style={{ fontWeight: "bold", fontSize: "13px" }}>
            <td style={{ textAlign: "left", paddingTop: "4px" }}>GRAND TOTAL</td>
            <td style={{ textAlign: "right", paddingTop: "4px" }}>{formatInr(receipt.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000000", margin: "6px 0", width: "100%" }}></div>

      {/* Footer payment details & UPI QR */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontSize: "10px", margin: "4px 0" }}>
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Paid via {receipt.paymentMethod}</div>
        {qrPosition === "Bottom" && receipt.paymentMethod === "UPI" && qr}
        <div style={{ marginTop: "6px", fontWeight: "bold", fontSize: "10px", whiteSpace: "pre-line", lineHeight: "1.3" }}>
          {receipt.thankYouMessage}
        </div>
      </div>
    </div>
  );
}

export function RetailTemplate({ receipt, qrPosition }: TemplateProps) {
const formatInr = (val: any) => `₹${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

  const qr = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "6px 0" }}>
      <div style={{ background: "#ffffff", padding: "6px", border: "1px solid #dddddd", display: "inline-block", marginBottom: "2px" }}>
        {receipt.upiQrCode ? (
          <img src={receipt.upiQrCode} style={{ width: "120px", height: "120px", display: "block" }} alt="UPI QR Code" />
        ) : (
          <QRCodeSVG value={receipt.upiPayload || ""} size={120} />
        )}
      </div>
      <span style={{ fontSize: "8px", color: "#555555", fontWeight: "bold" }}>Scan to Pay via UPI</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
      {/* Shop Info Header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "6px" }}>
        {receipt.shop.logo && (
          <img src={receipt.shop.logo} alt="Store Logo" style={{ maxHeight: "36px", objectFit: "contain", marginBottom: "6px" }} />
        )}
        <div style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "2px", lineHeight: "1.1" }}>
          {receipt.shop.name}
        </div>
        <div style={{ fontSize: "9px", color: "#333333", marginBottom: "1px" }}>{receipt.shop.address}</div>
        <div style={{ fontSize: "9px", color: "#333333", marginBottom: "1px" }}>PH: {receipt.shop.phone}</div>
        <div style={{ fontSize: "9px", color: "#333333" }}>GSTIN: {receipt.shop.gstin}</div>
      </div>

      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0", width: "100%" }}></div>

      {/* Invoice Info */}
      <div style={{ fontSize: "9px", lineHeight: "1.3", textAlign: "left", margin: "4px 0" }}>
        <div><strong>INV  :</strong> {receipt.invoiceNumber}</div>
        <div><strong>DATE :</strong> {receipt.date}</div>
        <div><strong>TIME :</strong> {receipt.time}</div>
        <div><strong>CASH :</strong> {receipt.cashier}</div>
        <div><strong>CUST :</strong> {receipt.customer.name}</div>
        {receipt.customer.phone && <div><strong>PHONE:</strong> +91 {receipt.customer.phone}</div>}
      </div>

      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0", width: "100%" }}></div>

      {qrPosition === "Top" && receipt.paymentMethod === "UPI" && qr}

      {/* Items Section: Traditional Retail Table style */}
      <table style={{ width: "100%", fontSize: "9px", borderCollapse: "collapse", margin: "4px 0" }}>
        <thead>
          <tr style={{ borderBottom: "1px dashed #000000" }}>
            <th align="left" style={{ width: "15%", paddingBottom: "3px", fontWeight: "bold" }}>#</th>
            <th align="left" style={{ width: "85%", paddingBottom: "3px", fontWeight: "bold" }}>Item Name</th>
          </tr>
          <tr style={{ borderBottom: "1px dashed #000000" }}>
            <th style={{ width: "15%" }}></th>
            <th align="left" style={{ width: "25%", paddingBottom: "3px", fontWeight: "bold" }}>Qty</th>
            <th align="right" style={{ width: "30%", paddingBottom: "3px", fontWeight: "bold" }}>Price</th>
            <th align="right" style={{ width: "30%", paddingBottom: "3px", fontWeight: "bold" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px dashed #dddddd", verticalAlign: "top" }}>
              <td colSpan={2} style={{ padding: "4px 0" }}>
                <div style={{ display: "flex" }}>
                  <span style={{ width: "15%" }}>{idx + 1}</span>
                  <span style={{ width: "85%", fontWeight: "bold" }}>{item.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "15%", marginTop: "2px" }}>
                  <span style={{ width: "25%", textAlign: "left" }}>{item.qty}</span>
                  <span style={{ width: "35%", textAlign: "right" }}>{formatInr(item.price)}</span>
                  <span style={{ width: "40%", textAlign: "right", fontWeight: "bold" }}>{formatInr(item.lineTotal)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0", width: "100%" }}></div>

      {/* Totals Summary */}
      <table style={{ width: "100%", fontSize: "9px", lineHeight: "1.3", margin: "4px 0" }}>
        <tbody>
          <tr>
            <td style={{ textAlign: "left", padding: "2px 0" }}>Subtotal</td>
            <td style={{ textAlign: "right", padding: "2px 0" }}>{formatInr(receipt.subtotal)}</td>
          </tr>
          {receipt.discount > 0 && (
            <tr>
              <td style={{ textAlign: "left", padding: "2px 0" }}>Discount</td>
              <td style={{ textAlign: "right", padding: "2px 0" }}>-{formatInr(receipt.discount)}</td>
            </tr>
          )}
          <tr>
            <td style={{ textAlign: "left", padding: "2px 0" }}>GST Tax</td>
            <td style={{ textAlign: "right", padding: "2px 0" }}>{formatInr(receipt.gst)}</td>
          </tr>
          <tr style={{ fontWeight: "bold", fontSize: "11px", borderTop: "1px dashed #000000" }}>
            <td style={{ textAlign: "left", paddingTop: "4px" }}>GRAND TOTAL</td>
            <td style={{ textAlign: "right", paddingTop: "4px" }}>{formatInr(receipt.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0", width: "100%" }}></div>

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontSize: "9px", margin: "4px 0" }}>
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Paid via {receipt.paymentMethod}</div>
        {qrPosition === "Bottom" && receipt.paymentMethod === "UPI" && qr}
        <div style={{ marginTop: "6px", fontWeight: "bold", whiteSpace: "pre-line", lineHeight: "1.3" }}>
          {receipt.thankYouMessage}
        </div>
      </div>
    </div>
  );
}

export function PremiumTemplate({ receipt, qrPosition }: TemplateProps) {
const formatInr = (val: any) => `₹${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

  const qr = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "8px 0" }}>
      <div style={{ background: "#ffffff", padding: "8px", border: "2px solid #000000", display: "inline-block", marginBottom: "3px" }}>
        {receipt.upiQrCode ? (
          <img src={receipt.upiQrCode} style={{ width: "150px", height: "150px", display: "block" }} alt="UPI QR Code" />
        ) : (
          <QRCodeSVG value={receipt.upiPayload || ""} size={150} />
        )}
      </div>
      <span style={{ fontSize: "9px", color: "#000000", fontWeight: "bold", letterSpacing: "1px" }}>SCAN TO PAY VIA UPI</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box", padding: "2px" }}>
      {/* Centered branding with large logo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "10px" }}>
        {receipt.shop.logo ? (
          <img src={receipt.shop.logo} alt="Store Logo" style={{ maxHeight: "50px", objectFit: "contain", marginBottom: "8px" }} />
        ) : (
          <div style={{ fontSize: "28px", marginBottom: "4px" }}>🏬</div>
        )}
        <div style={{ fontSize: "16px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "3px", lineHeight: "1.1" }}>
          {receipt.shop.name}
        </div>
        <div style={{ fontSize: "10px", color: "#555555", marginBottom: "2px", fontStyle: "italic" }}>{receipt.shop.address}</div>
        <div style={{ fontSize: "10px", color: "#555555", marginBottom: "2px" }}>PH: {receipt.shop.phone}</div>
        <div style={{ fontSize: "9px", color: "#777777", letterSpacing: "0.5px" }}>GSTIN: {receipt.shop.gstin}</div>
      </div>

      <div style={{ borderTop: "2px solid #000000", margin: "8px 0", width: "100%" }}></div>

      {/* Invoice Info */}
      <div style={{ fontSize: "10px", lineHeight: "1.4", textAlign: "center", margin: "6px 0", backgroundColor: "#f9f9f9", padding: "6px", borderRadius: "4px" }}>
        <div><strong>INVOICE:</strong> {receipt.invoiceNumber}</div>
        <div><strong>DATE:</strong> {receipt.date} &nbsp;|&nbsp; <strong>TIME:</strong> {receipt.time}</div>
        <div><strong>CASHIER:</strong> {receipt.cashier}</div>
        <div style={{ borderTop: "1px solid #eeeeee", margin: "4px 0" }}></div>
        <div><strong>CUSTOMER:</strong> {receipt.customer.name}</div>
        {receipt.customer.phone && <div><strong>CONTACT:</strong> +91 {receipt.customer.phone}</div>}
      </div>

      <div style={{ borderTop: "2px solid #000000", margin: "8px 0", width: "100%" }}></div>

      {qrPosition === "Top" && receipt.paymentMethod === "UPI" && qr}

      {/* Items List Table with premium design */}
      <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse", margin: "6px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000000" }}>
            <th align="left" style={{ paddingBottom: "4px", fontWeight: "900", textTransform: "uppercase" }}>Item Description</th>
            <th align="right" style={{ paddingBottom: "4px", fontWeight: "900", textTransform: "uppercase" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #eeeeee" }}>
              <td style={{ padding: "6px 0", textAlign: "left" }}>
                <div style={{ fontWeight: "bold" }}>{item.name}</div>
                <div style={{ fontSize: "9px", color: "#666666" }}>{item.qty} Unit(s) x {formatInr(item.price)}</div>
              </td>
              <td align="right" style={{ padding: "6px 0", textAlign: "right", verticalAlign: "middle", fontWeight: "bold" }}>
                {formatInr(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "2px solid #000000", margin: "8px 0", width: "100%" }}></div>

      {/* Totals Summary */}
      <table style={{ width: "100%", fontSize: "10px", lineHeight: "1.4", margin: "6px 0" }}>
        <tbody>
          <tr>
            <td style={{ textAlign: "left", padding: "2px 0", color: "#555555" }}>Subtotal</td>
            <td style={{ textAlign: "right", padding: "2px 0" }}>{formatInr(receipt.subtotal)}</td>
          </tr>
          {receipt.discount > 0 && (
            <tr>
              <td style={{ textAlign: "left", padding: "2px 0", color: "#dc2626" }}>Discount</td>
              <td style={{ textAlign: "right", padding: "2px 0", color: "#dc2626" }}>-{formatInr(receipt.discount)}</td>
            </tr>
          )}
          <tr>
            <td style={{ textAlign: "left", padding: "2px 0", color: "#555555" }}>GST Tax</td>
            <td style={{ textAlign: "right", padding: "2px 0" }}>{formatInr(receipt.gst)}</td>
          </tr>
          <tr style={{ fontWeight: "900", fontSize: "14px", borderTop: "2px solid #000000" }}>
            <td style={{ textAlign: "left", paddingTop: "6px" }}>GRAND TOTAL</td>
            <td style={{ textAlign: "right", paddingTop: "6px" }}>{formatInr(receipt.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: "2px solid #000000", margin: "8px 0", width: "100%" }}></div>

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontSize: "10px", margin: "6px 0" }}>
        <div style={{ fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Paid via {receipt.paymentMethod}</div>
        {qrPosition === "Bottom" && receipt.paymentMethod === "UPI" && qr}
        <div style={{ marginTop: "10px", fontStyle: "italic", fontWeight: "bold", whiteSpace: "pre-line", lineHeight: "1.4" }}>
          {receipt.thankYouMessage}
        </div>
      </div>
    </div>
  );
}

export function CompactTemplate({ receipt }: TemplateProps) {
const formatInr = (val: any) => `₹${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box", fontSize: "9px", lineHeight: "1.1" }}>
      {/* Minimal branding - No Logo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "4px" }}>
        <div style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" }}>
          {receipt.shop.name}
        </div>
        <div style={{ fontSize: "8px", color: "#333333" }}>
          {receipt.shop.phone} | GST:{receipt.shop.gstin}
        </div>
      </div>

      <div style={{ borderTop: "1px dotted #000000", margin: "3px 0", width: "100%" }}></div>

      {/* Invoice Info */}
      <div style={{ fontSize: "8px", margin: "2px 0" }}>
        <div>INV: {receipt.invoiceNumber}</div>
        <div>DAT: {receipt.date} {receipt.time}</div>
        <div>CUST: {receipt.customer.name.slice(0, 15)}</div>
      </div>

      <div style={{ borderTop: "1px dotted #000000", margin: "3px 0", width: "100%" }}></div>

      {/* Compact Items List Table */}
      <table style={{ width: "100%", fontSize: "8px", borderCollapse: "collapse", margin: "2px 0" }}>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={idx} style={{ verticalAlign: "top" }}>
              <td style={{ padding: "1px 0", textAlign: "left" }}>
                {item.qty}x {item.name.slice(0, 18)}
              </td>
              <td align="right" style={{ padding: "1px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                {formatInr(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dotted #000000", margin: "3px 0", width: "100%" }}></div>

      {/* Totals Summary */}
      <table style={{ width: "100%", fontSize: "8px", margin: "2px 0" }}>
        <tbody>
          <tr>
            <td style={{ textAlign: "left" }}>Sub / GST</td>
            <td style={{ textAlign: "right" }}>{formatInr(receipt.subtotal)} / {formatInr(receipt.gst)}</td>
          </tr>
          {receipt.discount > 0 && (
            <tr>
              <td style={{ textAlign: "left" }}>Discount</td>
              <td style={{ textAlign: "right" }}>-{formatInr(receipt.discount)}</td>
            </tr>
          )}
          <tr style={{ fontWeight: "bold", fontSize: "10px" }}>
            <td style={{ textAlign: "left" }}>TOTAL</td>
            <td style={{ textAlign: "right" }}>{formatInr(receipt.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: "1px dotted #000000", margin: "3px 0", width: "100%" }}></div>

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontSize: "8px", margin: "2px 0" }}>
        <div>Paid: {receipt.paymentMethod}</div>
        <div style={{ marginTop: "2px", fontWeight: "bold", fontSize: "8px" }}>
          {receipt.thankYouMessage}
        </div>
      </div>
    </div>
  );
}

export function ModernTemplate({ receipt, qrPosition }: TemplateProps) {
const formatInr = (val: any) => `₹${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

  const qr = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "6px 0" }}>
      <div style={{ background: "#ffffff", padding: "6px", border: "1px solid #2563eb", display: "inline-block", marginBottom: "2px" }}>
        {receipt.upiQrCode ? (
          <img src={receipt.upiQrCode} style={{ width: "130px", height: "130px", display: "block" }} alt="UPI QR Code" />
        ) : (
          <QRCodeSVG value={receipt.upiPayload || ""} size={130} />
        )}
      </div>
      <span style={{ fontSize: "8px", color: "#2563eb", fontWeight: "bold" }}>Scan to Pay via UPI</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box", fontFamily: "sans-serif" }}>
      {/* Modern Banner Header */}
      <div style={{ backgroundColor: "#2563eb", color: "#ffffff", padding: "10px", borderRadius: "6px", textAlign: "center", marginBottom: "8px" }}>
        {receipt.shop.logo && (
          <img src={receipt.shop.logo} alt="Store Logo" style={{ maxHeight: "36px", objectFit: "contain", marginBottom: "4px", backgroundColor: "#ffffff", padding: "2px", borderRadius: "4px" }} />
        )}
        <div style={{ fontSize: "15px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {receipt.shop.name}
        </div>
        <div style={{ fontSize: "9px", opacity: 0.9, marginTop: "2px" }}>{receipt.shop.address}</div>
        <div style={{ fontSize: "9px", opacity: 0.9 }}>Ph: {receipt.shop.phone} | GSTIN: {receipt.shop.gstin}</div>
      </div>

      {/* Invoice Meta Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "9px", backgroundColor: "#f1f5f9", padding: "6px", borderRadius: "4px", margin: "4px 0" }}>
        <div><strong>Invoice #:</strong> {receipt.invoiceNumber}</div>
        <div style={{ textAlign: "right" }}><strong>Date:</strong> {receipt.date}</div>
        <div><strong>Customer:</strong> {receipt.customer.name}</div>
        <div style={{ textAlign: "right" }}><strong>Cashier:</strong> {receipt.cashier}</div>
      </div>

      {qrPosition === "Top" && receipt.paymentMethod === "UPI" && qr}

      {/* Items Table */}
      <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse", margin: "6px 0" }}>
        <thead>
          <tr style={{ backgroundColor: "#2563eb", color: "#ffffff" }}>
            <th align="left" style={{ padding: "4px 6px", borderRadius: "3px 0 0 3px" }}>Item Description</th>
            <th align="right" style={{ padding: "4px 6px" }}>Qty</th>
            <th align="right" style={{ padding: "4px 6px", borderRadius: "0 3px 3px 0" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "4px 6px" }}>{item.name}</td>
              <td align="right" style={{ padding: "4px 6px" }}>{item.qty}</td>
              <td align="right" style={{ padding: "4px 6px", fontWeight: "bold" }}>{formatInr(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ backgroundColor: "#f8fafc", padding: "6px 8px", borderRadius: "4px", margin: "4px 0", fontSize: "10px" }}>
        <div style={{ display: "flex", justify: "space-between", marginBottom: "2px" }}>
          <span>Subtotal:</span><span>{formatInr(receipt.subtotal)}</span>
        </div>
        {receipt.discount > 0 && (
          <div style={{ display: "flex", justify: "space-between", color: "#dc2626", marginBottom: "2px" }}>
            <span>Discount:</span><span>-{formatInr(receipt.discount)}</span>
          </div>
        )}
        <div style={{ display: "flex", justify: "space-between", marginBottom: "2px" }}>
          <span>Tax:</span><span>{formatInr(receipt.gst)}</span>
        </div>
        <div style={{ display: "flex", justify: "space-between", fontWeight: "bold", fontSize: "12px", color: "#2563eb", borderTop: "1px solid #cbd5e1", paddingTop: "4px", marginTop: "4px" }}>
          <span>GRAND TOTAL:</span><span>{formatInr(receipt.grandTotal)}</span>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: "9px", margin: "6px 0" }}>
        <div style={{ fontWeight: "bold", color: "#2563eb" }}>Paid via {receipt.paymentMethod}</div>
        {qrPosition === "Bottom" && receipt.paymentMethod === "UPI" && qr}
        <div style={{ marginTop: "4px", color: "#475569" }}>{receipt.thankYouMessage}</div>
      </div>
    </div>
  );
}

export function MinimalTemplate({ receipt }: TemplateProps) {
const formatInr = (val: any) => `₹${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: "10px" }}>
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "14px", fontWeight: "bold" }}>{receipt.shop.name}</div>
        <div style={{ fontSize: "9px", color: "#666" }}>{receipt.shop.phone} | GST: {receipt.shop.gstin}</div>
      </div>

      <div style={{ borderTop: "1px solid #ccc", margin: "4px 0" }}></div>

      <div style={{ display: "flex", justify: "space-between", fontSize: "9px" }}>
        <span>Inv: {receipt.invoiceNumber}</span>
        <span>{receipt.date}</span>
      </div>

      <div style={{ borderTop: "1px solid #ccc", margin: "4px 0" }}></div>

      <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse" }}>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: "2px 0" }}>{item.qty}x {item.name}</td>
              <td align="right" style={{ padding: "2px 0" }}>{formatInr(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px solid #ccc", margin: "4px 0" }}></div>

      <div style={{ display: "flex", justify: "space-between", fontWeight: "bold", fontSize: "12px" }}>
        <span>TOTAL:</span><span>{formatInr(receipt.grandTotal)}</span>
      </div>

      <div style={{ textAlign: "center", fontSize: "9px", marginTop: "8px", color: "#666" }}>
        <div>Paid via {receipt.paymentMethod}</div>
        <div>{receipt.thankYouMessage}</div>
      </div>
    </div>
  );
}

export function GstProfessionalTemplate({ receipt, qrPosition }: TemplateProps) {
const formatInr = (val: any) => `₹${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

  const qr = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "6px 0" }}>
      <div style={{ background: "#ffffff", padding: "6px", border: "1px solid #047857", display: "inline-block", marginBottom: "2px" }}>
        {receipt.upiQrCode ? (
          <img src={receipt.upiQrCode} style={{ width: "120px", height: "120px", display: "block" }} alt="UPI QR Code" />
        ) : (
          <QRCodeSVG value={receipt.upiPayload || ""} size={120} />
        )}
      </div>
      <span style={{ fontSize: "8px", color: "#047857", fontWeight: "bold" }}>Scan to Pay via UPI</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box", fontFamily: "sans-serif" }}>
      {/* GST B2B Banner */}
      <div style={{ border: "2px solid #047857", borderRadius: "6px", padding: "8px", marginBottom: "8px" }}>
        <div style={{ textAlign: "center", borderBottom: "1px solid #047857", pb: "4px", marginBottom: "6px" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#047857", textTransform: "uppercase", letterSpacing: "1px" }}>TAX INVOICE</div>
          <div style={{ fontSize: "15px", fontWeight: "bold", color: "#0f172a" }}>{receipt.shop.name}</div>
          <div style={{ fontSize: "9px", color: "#475569" }}>{receipt.shop.address}</div>
          <div style={{ fontSize: "9px", fontWeight: "bold", color: "#047857" }}>GSTIN: {receipt.shop.gstin} | PH: {receipt.shop.phone}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "9px" }}>
          <div>
            <div style={{ fontWeight: "bold", color: "#047857" }}>DETAILS OF RECEIVER / BUYER</div>
            <div><strong>Name:</strong> {receipt.customer.name}</div>
            {receipt.customer.phone && <div><strong>Phone:</strong> +91 {receipt.customer.phone}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: "bold", color: "#047857" }}>INVOICE SPECIFICATION</div>
            <div><strong>Invoice No:</strong> {receipt.invoiceNumber}</div>
            <div><strong>Date & Time:</strong> {receipt.date} {receipt.time}</div>
            <div><strong>Cashier:</strong> {receipt.cashier}</div>
          </div>
        </div>
      </div>

      {qrPosition === "Top" && receipt.paymentMethod === "UPI" && qr}

      {/* Itemized Table with GST Tax Column */}
      <table style={{ width: "100%", fontSize: "9px", borderCollapse: "collapse", margin: "4px 0", border: "1px solid #cbd5e1" }}>
        <thead>
          <tr style={{ backgroundColor: "#047857", color: "#ffffff" }}>
            <th align="left" style={{ padding: "4px" }}>Item Description</th>
            <th align="right" style={{ padding: "4px" }}>Qty</th>
            <th align="right" style={{ padding: "4px" }}>Rate</th>
            <th align="right" style={{ padding: "4px" }}>Tax %</th>
            <th align="right" style={{ padding: "4px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "4px" }}>{item.name}</td>
              <td align="right" style={{ padding: "4px" }}>{item.qty}</td>
              <td align="right" style={{ padding: "4px" }}>{formatInr(item.price)}</td>
              <td align="right" style={{ padding: "4px" }}>{item.gst || 18}%</td>
              <td align="right" style={{ padding: "4px", fontWeight: "bold" }}>{formatInr(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Tax Breakdown & Grand Total Box */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "6px 0", fontSize: "9px" }}>
        <div style={{ border: "1px solid #e2e8f0", padding: "6px", borderRadius: "4px" }}>
          <div style={{ fontWeight: "bold", color: "#047857", marginBottom: "2px" }}>TAX SUMMARY</div>
          <div>Taxable Amount: {formatInr(receipt.subtotal - receipt.discount)}</div>
          <div>CGST + SGST (GST): {formatInr(receipt.gst)}</div>
          <div style={{ marginTop: "4px", fontSize: "8px", color: "#64748b" }}>Tax Invoice issued under GST Rules.</div>
        </div>
        <div style={{ border: "1px solid #047857", padding: "6px", borderRadius: "4px", backgroundColor: "#f0fdf4" }}>
          <div style={{ display: "flex", justify: "space-between", marginBottom: "2px" }}><span>Subtotal:</span><span>{formatInr(receipt.subtotal)}</span></div>
          {receipt.discount > 0 && <div style={{ display: "flex", justify: "space-between", color: "#dc2626", marginBottom: "2px" }}><span>Discount:</span><span>-{formatInr(receipt.discount)}</span></div>}
          <div style={{ display: "flex", justify: "space-between", marginBottom: "2px" }}><span>Total Tax:</span><span>{formatInr(receipt.gst)}</span></div>
          <div style={{ display: "flex", justify: "space-between", fontWeight: "bold", fontSize: "11px", color: "#047857", borderTop: "1px solid #047857", paddingTop: "4px", marginTop: "4px" }}>
            <span>GRAND TOTAL:</span><span>{formatInr(receipt.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Signatory & Footer */}
      <div style={{ display: "flex", justify: "space-between", alignItems: "flex-end", margin: "8px 0", fontSize: "9px" }}>
        <div style={{ textAlign: "center" }}>
          {qrPosition === "Bottom" && receipt.paymentMethod === "UPI" && qr}
          <div style={{ color: "#047857", fontWeight: "bold" }}>Paid via {receipt.paymentMethod}</div>
        </div>
        <div style={{ textAlign: "right", borderTop: "1px solid #94a3b8", paddingTop: "4px", width: "120px" }}>
          <div style={{ fontWeight: "bold", fontSize: "8px", textTransform: "uppercase" }}>FOR {receipt.shop.name}</div>
          <div style={{ fontSize: "8px", color: "#64748b", marginTop: "16px" }}>Authorized Signatory</div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: "8px", color: "#475569", marginTop: "4px" }}>{receipt.thankYouMessage}</div>
    </div>
  );
}

export function ThermalTemplate({ receipt, qrPosition }: TemplateProps) {
  return <ClassicTemplate receipt={receipt} paperWidth="58mm" qrPosition={qrPosition} />;
}

interface ReceiptRendererProps {
  receipt: ReceiptData;
  template: "Classic" | "Modern" | "Minimal" | "Retail" | "Wholesale" | "GST Professional" | "Restaurant" | "Medical" | "Fashion" | "Compact" | "Thermal" | string;
  paperWidth?: "58mm" | "80mm" | "A4";
  qrPosition?: "Top" | "Bottom";
}

const safeNumber = (val: any, fallback = 0): number => {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
};

export function normalizeReceiptData(raw: any): ReceiptData {
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  const items: ReceiptItem[] = rawItems.map((item: any) => {
    const qty = safeNumber(item?.qty ?? item?.quantity, 1);
    const price = safeNumber(item?.price ?? item?.unitPrice ?? item?.unit_price, 0);
    const lineTotal = safeNumber(
      item?.lineTotal ?? item?.total ?? item?.totalAmount ?? item?.subtotal,
      qty * price
    );
    return {
      name: String(item?.name || "Item"),
      qty,
      price,
      discount: safeNumber(item?.discount, 0),
      gst: safeNumber(item?.gst ?? item?.taxRate, 0),
      lineTotal,
    };
  });

  const subtotal = safeNumber(
    raw?.subtotal,
    items.reduce((acc, i) => acc + i.lineTotal, 0)
  );
  const discount = safeNumber(raw?.discount ?? raw?.discountTotal, 0);
  const gst = safeNumber(raw?.gst ?? raw?.tax, 0);
  const grandTotal = safeNumber(
    raw?.grandTotal ?? raw?.total ?? raw?.totalAmount,
    Math.max(0, subtotal - discount + gst)
  );

  return {
    shop: {
      name: String(raw?.shop?.name || "Apka Bill Store"),
      address: String(raw?.shop?.address || "Store Address"),
      phone: String(raw?.shop?.phone || "0000000000"),
      gstin: String(raw?.shop?.gstin || "N/A"),
      logo: raw?.shop?.logo,
      upiId: raw?.shop?.upiId || "apkabill@upi",
    },
    invoiceNumber: String(raw?.invoiceNumber || raw?.invoice_number || "INV-00001"),
    date: String(raw?.date || new Date().toLocaleDateString("en-IN")),
    time: String(raw?.time || new Date().toLocaleTimeString("en-IN")),
    cashier: String(raw?.cashier || "Admin"),
    customer: {
      name: String(raw?.customer?.name || "Walk-in Customer"),
      phone: String(raw?.customer?.phone || ""),
    },
    items,
    subtotal,
    discount,
    gst,
    grandTotal,
    paymentMethod: String(raw?.paymentMethod || raw?.paymentMode || raw?.payment_method || "CASH"),
    upiQrCode: raw?.upiQrCode,
    upiPayload: raw?.upiPayload,
    thankYouMessage: String(
      raw?.thankYouMessage || raw?.termsAndConditions || raw?.receipt_footer || "Thank you for shopping with us!"
    ),
  };
}

export function ReceiptRenderer({
  receipt,
  template,
  paperWidth = "58mm",
  qrPosition = "Bottom"
}: ReceiptRendererProps) {
  const normWidth = paperWidth === "A4" ? "80mm" : paperWidth;
  const safeReceipt = normalizeReceiptData(receipt);

  const props = {
    receipt: safeReceipt,
    paperWidth: normWidth,
    qrPosition
  };

  const isVoid = (receipt as any).status === "VOID";

  const renderTemplate = () => {
    switch (template) {
      case "Modern":
        return <ModernTemplate {...props} />;
      case "Retail":
        return <RetailTemplate {...props} />;
      case "Minimal":
        return <MinimalTemplate {...props} />;
      case "GST Professional":
      case "Wholesale":
      case "Premium":
        return <GstProfessionalTemplate {...props} />;
      case "Compact":
        return <CompactTemplate {...props} />;
      case "Thermal":
        return <ThermalTemplate {...props} />;
      case "Classic":
      case "Restaurant":
      case "Medical":
      case "Fashion":
      default:
        return <ClassicTemplate {...props} />;
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", width: "100%" }}>
      {isVoid && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-30deg)",
          fontSize: "48px",
          fontWeight: "900",
          color: "rgba(239, 68, 68, 0.12)",
          border: "4px solid rgba(239, 68, 68, 0.12)",
          padding: "4px 16px",
          borderRadius: "8px",
          pointerEvents: "none",
          zIndex: 9999,
          letterSpacing: "4px",
          textTransform: "uppercase",
          fontFamily: "sans-serif"
        }}>
          VOID
        </div>
      )}
      
      {isVoid && (
        <div style={{
          border: "1px solid rgba(239, 68, 68, 0.3)",
          backgroundColor: "rgba(239, 68, 68, 0.05)",
          color: "#ef4444",
          fontSize: "9px",
          fontWeight: "bold",
          padding: "6px",
          borderRadius: "6px",
          marginBottom: "8px",
          textAlign: "left",
          lineHeight: "1.35",
          fontFamily: "monospace"
        }}>
          <div>STATUS: VOID</div>
          <div>REASON: {(receipt as any).voidReason || "N/A"}</div>
          <div>VOIDED BY: {(receipt as any).voidedBy || "N/A"}</div>
          <div>VOIDED ON: {(receipt as any).voidedAt ? new Date((receipt as any).voidedAt).toLocaleString("en-IN") : "N/A"}</div>
        </div>
      )}

      {renderTemplate()}
    </div>
  );
}

