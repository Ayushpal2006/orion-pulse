import type { OfflinePendingSale } from "./offline-db";

/**
 * Pure mapper converting a queued frontend IndexedDB OfflinePendingSale (Rupees)
 * into a server /checkout DTO with consistent keys and idempotency identifiers.
 */
export function buildCheckoutPayloadFromOfflineSale(sale: OfflinePendingSale) {
  const paid = sale.amount_paid ?? sale.total_amount;
  const computedBalance =
    sale.balance !== undefined ? sale.balance : Math.max(0, (sale.total_amount || 0) - paid);

  return {
    items: (sale.items || []).map((i) => ({
      productId: Number(i.product_id),
      quantity: Number(i.quantity) || 1,
      price: Number(i.unit_price) || 0,
      unitPrice: Number(i.unit_price) || 0,
      discount: Number(i.discount) || 0,
      discountPercent: Number(i.discount) || 0,
    })),
    customerId: sale.customer_id ?? undefined,
    customerPhone: sale.customer_phone || undefined,
    customerName: sale.customer_name || undefined,
    cashierName: sale.cashier_name || "Offline POS",
    paymentMethod: sale.payment_method || "Cash",
    subtotal: Number(sale.subtotal) || 0,
    discount: Number(sale.discount) || 0,
    gst: Number(sale.tax) || 0,
    tax: Number(sale.tax) || 0,
    grandTotal: Number(sale.total_amount) || 0,
    totalAmount: Number(sale.total_amount) || 0,
    paidAmount: Number(paid) || 0,
    amountPaid: Number(paid) || 0,
    balance: Number(computedBalance) || 0,
    offlineIdentifier: sale.offlineId,
    offlineInvoiceNumber: sale.invoice_number,
  };
}

