// Universal Document Platform Foundation for Apka Bill V2

export type DocumentType =
  | "receipt"
  | "invoice"
  | "purchase_order"
  | "quotation"
  | "delivery_challan"
  | "payment_receipt"
  | "credit_note"
  | "debit_note"
  | "barcode_label"
  | "expense_voucher";

export interface UniversalDocumentItem {
  id: string | number;
  code?: string;
  name: string;
  description?: string;
  hsn?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
}

export interface UniversalDocumentParty {
  name: string;
  gstin?: string;
  pan?: string;
  address?: string;
  phone?: string;
  email?: string;
  stateCode?: string;
}

export interface UniversalDocumentModel {
  id: string;
  documentType: DocumentType;
  title: string;
  documentNumber: string;
  issueDate: string;
  dueDate?: string;
  issuer: UniversalDocumentParty;
  recipient?: UniversalDocumentParty;
  items: UniversalDocumentItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  terms?: string;
  signatoryName?: string;
}

export class UniversalDocumentRenderer {
  static toHtml(doc: UniversalDocumentModel): string {
    const itemsTableRows = doc.items
      .map(
        (item, idx) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px;">${idx + 1}</td>
          <td style="padding: 8px; font-weight: 600;">${item.name}</td>
          <td style="padding: 8px; text-align: center;">${item.qty} ${item.unit || ""}</td>
          <td style="padding: 8px; text-align: right;">₹${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 600;">₹${item.totalAmount.toFixed(2)}</td>
        </tr>`
      )
      .join("");

    return `
      <div style="max-width: 800px; margin: 0 auto; padding: 24px; font-family: sans-serif; color: #111827; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1d4ed8;">${doc.issuer.name}</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #4b5563;">${doc.issuer.address || ""}</p>
            ${doc.issuer.gstin ? `<p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600;">GSTIN: ${doc.issuer.gstin}</p>` : ""}
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; background: #eff6ff; color: #1d4ed8; border-radius: 9999px;">${doc.title}</span>
            <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 700;"># ${doc.documentNumber}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #6b7280;">Date: ${doc.issueDate}</p>
          </div>
        </div>

        ${
          doc.recipient?.name
            ? `
        <div style="margin-bottom: 20px; padding: 12px; background: #f9fafb; border-radius: 8px;">
          <p style="margin: 0; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase;">Bill To</p>
          <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: 700;">${doc.recipient.name}</p>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: #4b5563;">${doc.recipient.address || ""}</p>
        </div>`
            : ""
        }

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <thead>
            <tr style="background: #f3f4f6; text-align: left; font-weight: 700; color: #374151;">
              <th style="padding: 8px; width: 40px;">#</th>
              <th style="padding: 8px;">Item Description</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Rate</th>
              <th style="padding: 8px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTableRows}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
          <div style="width: 250px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>Subtotal:</span><span>₹${doc.subtotal.toFixed(2)}</span></div>
            ${doc.discountTotal > 0 ? `<div style="display: flex; justify-content: space-between; padding: 4px 0; color: #dc2626;"><span>Discount:</span><span>-₹${doc.discountTotal.toFixed(2)}</span></div>` : ""}
            ${doc.taxTotal > 0 ? `<div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>Tax/GST:</span><span>₹${doc.taxTotal.toFixed(2)}</span></div>` : ""}
            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 800; font-size: 16px; border-top: 2px solid #111827;"><span>TOTAL:</span><span>₹${doc.grandTotal.toFixed(2)}</span></div>
          </div>
        </div>

        ${doc.terms ? `<div style="font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px;"><strong>Terms & Conditions:</strong> ${doc.terms}</div>` : ""}
      </div>`;
  }
}
