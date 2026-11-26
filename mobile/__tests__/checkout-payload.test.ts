import { queuedPayloadToCheckoutRequest } from '../src/sync/checkoutPayload';

describe('queuedPayloadToCheckoutRequest (paise queue -> rupee API)', () => {
  const payload = {
    offlineIdentifier: 'abc',
    subtotal: 360000,
    discount: 10050,
    gst: 64800,
    grandTotal: 414750,
    paidAmount: 414750,
    balance: 0,
    items: [{ productId: 7, quantity: 3, sellingPrice: 120000, discount: 5025, lineTotal: 354975 }],
  };

  it('converts request-level and item-level paise to rupees', () => {
    const out = queuedPayloadToCheckoutRequest(payload);
    expect(out.subtotal).toBe(3600);
    expect(out.discount).toBe(100.5);
    expect(out.paidAmount).toBe(4147.5);
    expect(out.balance).toBe(0);
    expect(out.items[0].sellingPrice).toBe(1200);
    expect(out.items[0].discount).toBe(50.25);
  });

  it('round-trips through the backend Math.round(x * 100) without drift', () => {
    for (const paise of [0, 1, 99, 100, 119999, 120000, 9999999999]) {
      const rupees = queuedPayloadToCheckoutRequest({ paidAmount: paise }).paidAmount;
      expect(Math.round(rupees * 100)).toBe(paise);
    }
  });

  it('does not mutate the input and leaves non-money fields alone', () => {
    const copy = JSON.parse(JSON.stringify(payload));
    const out = queuedPayloadToCheckoutRequest(payload);
    expect(payload).toEqual(copy);
    expect(out.offlineIdentifier).toBe('abc');
    expect(out.items[0].quantity).toBe(3);
  });

  it('omits absent fields and zeroes non-finite ones', () => {
    expect(queuedPayloadToCheckoutRequest({ items: [] })).toEqual({ items: [] });
    expect(queuedPayloadToCheckoutRequest({ discount: NaN }).discount).toBe(0);
  });
});
