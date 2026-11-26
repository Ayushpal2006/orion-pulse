import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCheckoutPayloadFromOfflineSale } from "../offline-checkout-mapper";
import type { OfflinePendingSale } from "../offline-db";

describe("Frontend offline sync -> /checkout DTO mapping", () => {
  it("preserves exact rupee totals, item discounts, and customer info on discounted bill", () => {
    const sale: OfflinePendingSale = {
      offlineId: "OFF-1001",
      invoice_number: "INV-OFF-1001",
      organization_id: "2",
      store_id: "5",
      customer_id: 42,
      customer_phone: "9876543210",
      customer_name: "Ramesh Kumar",
      cashier_name: "Priya",
      items: [
        {
          product_id: 101,
          name: "Toor Dal 1kg",
          unit_price: 150,
          quantity: 2,
          discount: 10,
          subtotal: 270,
        },
      ],
      subtotal: 300,
      discount: 30,
      tax: 13.5,
      total_amount: 283.5,
      payment_method: "UPI",
      amount_paid: 283.5,
      balance: 0,
      change_amount: 0,
      created_at: "2026-11-10T10:00:00.000Z",
      syncStatus: "pending",
    };

    const dto = buildCheckoutPayloadFromOfflineSale(sale);
    assert.equal(dto.offlineIdentifier, "OFF-1001");
    assert.equal(dto.offlineInvoiceNumber, "INV-OFF-1001");
    assert.equal(dto.customerPhone, "9876543210");
    assert.equal(dto.customerName, "Ramesh Kumar");
    assert.equal(dto.cashierName, "Priya");
    assert.equal(dto.subtotal, 300);
    assert.equal(dto.discount, 30);
    assert.equal(dto.gst, 13.5);
    assert.equal(dto.grandTotal, 283.5);
    assert.equal(dto.paidAmount, 283.5);
    assert.equal(dto.balance, 0);
    assert.equal(dto.items[0].discount, 10);
    assert.equal(dto.items[0].discountPercent, 10);
    assert.equal(dto.items[0].unitPrice, 150);
  });

  it("preserves partial payment and computes unpaid balance cleanly", () => {
    const sale: OfflinePendingSale = {
      offlineId: "OFF-1002",
      invoice_number: "INV-OFF-1002",
      items: [
        {
          product_id: 202,
          name: "Atta 10kg",
          unit_price: 400,
          quantity: 3,
          discount: 0,
          subtotal: 1200,
        },
      ],
      subtotal: 1200,
      discount: 0,
      tax: 0,
      total_amount: 1200,
      payment_method: "Cash",
      amount_paid: 500,
      change_amount: 0,
      created_at: "2026-11-10T10:05:00.000Z",
      syncStatus: "pending",
    };

    const dto = buildCheckoutPayloadFromOfflineSale(sale);
    assert.equal(dto.grandTotal, 1200);
    assert.equal(dto.paidAmount, 500);
    assert.equal(dto.amountPaid, 500);
    assert.equal(dto.balance, 700);
  });

  it("keeps ₹1,200 checkout values intact without double-scaling", () => {
    const sale: OfflinePendingSale = {
      offlineId: "OFF-1200",
      invoice_number: "INV-OFF-1200",
      items: [
        {
          product_id: 1,
          name: "Cooking Oil 5L",
          unit_price: 1200,
          quantity: 1,
          subtotal: 1200,
        },
      ],
      subtotal: 1200,
      discount: 0,
      tax: 0,
      total_amount: 1200,
      payment_method: "UPI",
      amount_paid: 1200,
      change_amount: 0,
      created_at: "2026-11-10T10:10:00.000Z",
      syncStatus: "pending",
    };

    const dto = buildCheckoutPayloadFromOfflineSale(sale);
    assert.equal(dto.subtotal, 1200);
    assert.equal(dto.grandTotal, 1200);
    assert.equal(dto.paidAmount, 1200);
    assert.equal(dto.balance, 0);
  });
});
