/**
 * Converts a queued offline-sale payload into the shape POST /api/checkout expects.
 *
 * The mobile SQLite layer and sync_queue store every monetary value as integer PAISE.
 * The backend checkout API takes RUPEES for request-level and item-level money
 * (discount, paidAmount, balance, items[].discount, ...) and multiplies by 100 itself.
 * Sending paise unconverted makes the backend multiply twice: discounts wipe the total
 * and paid/balance come out 100x too large.
 *
 * Every payload ever enqueued is in paise, so conversion happens at send time. That also
 * fixes sales that were queued before this fix and have not synced yet.
 */

const paiseToRupees = (paise: unknown): number => {
  const n = Number(paise);
  if (!Number.isFinite(n)) return 0;
  // Integer paise / 100 is exact to 2 decimals; backend re-rounds via Math.round(x * 100).
  return Math.round(n) / 100;
};

const REQUEST_MONEY_FIELDS = ['subtotal', 'discount', 'gst', 'grandTotal', 'paidAmount', 'balance'] as const;
const ITEM_MONEY_FIELDS = ['sellingPrice', 'discount', 'lineTotal'] as const;

export function queuedPayloadToCheckoutRequest<T extends Record<string, any>>(payload: T): T {
  const out: Record<string, any> = { ...payload };

  for (const field of REQUEST_MONEY_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = paiseToRupees(out[field]);
    }
  }

  if (Array.isArray(out.items)) {
    out.items = out.items.map((item: Record<string, any>) => {
      const converted: Record<string, any> = { ...item };
      for (const field of ITEM_MONEY_FIELDS) {
        if (converted[field] !== undefined && converted[field] !== null) {
          converted[field] = paiseToRupees(converted[field]);
        }
      }
      return converted;
    });
  }

  return out as T;
}
