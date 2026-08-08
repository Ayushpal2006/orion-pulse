import React from "react";
import { ReceiptRenderer, ReceiptData, ReceiptRendererProps } from "./receipt-templates";

export interface InvoiceTemplateRendererProps extends ReceiptRendererProps {}

/**
 * InvoiceTemplateRenderer
 * Single Source of Truth component for rendering receipt and invoice templates across:
 * - View Receipt Modal & Pages
 * - Browser Print Mode (@media print)
 * - Static HTML Generation
 */
export function InvoiceTemplateRenderer(props: InvoiceTemplateRendererProps) {
  return <ReceiptRenderer {...props} />;
}

export type { ReceiptData };
