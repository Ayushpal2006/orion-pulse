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
  const formatInr = (val: number) => `₹${val.toFixed(2)}`;

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
  const formatInr = (val: number) => `₹${val.toFixed(2)}`;

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
  const formatInr = (val: number) => `₹${val.toFixed(2)}`;

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
  const formatInr = (val: number) => `₹${val.toFixed(2)}`;

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

interface ReceiptRendererProps {
  receipt: ReceiptData;
  template: "Classic" | "Retail" | "Premium" | "Compact";
  paperWidth?: "58mm" | "80mm" | "A4";
  qrPosition?: "Top" | "Bottom";
}

export function ReceiptRenderer({
  receipt,
  template,
  paperWidth = "58mm",
  qrPosition = "Bottom"
}: ReceiptRendererProps) {
  const normWidth = paperWidth === "A4" ? "80mm" : paperWidth;

  const props = {
    receipt,
    paperWidth: normWidth,
    qrPosition
  };

  switch (template) {
    case "Retail":
      return <RetailTemplate {...props} />;
    case "Premium":
      return <PremiumTemplate {...props} />;
    case "Compact":
      return <CompactTemplate {...props} />;
    case "Classic":
    default:
      return <ClassicTemplate {...props} />;
  }
}
