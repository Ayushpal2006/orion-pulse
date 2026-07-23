import test from "node:test";
import assert from "node:assert/strict";

/**
 * Pure calculation functions matching backend/src/services/purchase.service.ts
 */
export function calculateMarginAndMarkup(purchasePriceRs: number, sellingPriceRs: number) {
  const purchasePricePaise = Math.round(purchasePriceRs * 100);
  const sellingPricePaise = Math.round(sellingPriceRs * 100);

  const newAverageCostPaise = purchasePricePaise;

  const margin = sellingPricePaise > 0 
    ? Math.round(((sellingPricePaise - newAverageCostPaise) / sellingPricePaise) * 100)
    : 0;

  const markup = newAverageCostPaise > 0
    ? Math.round(((sellingPricePaise - newAverageCostPaise) / newAverageCostPaise) * 100)
    : 0;

  return {
    purchasePricePaise,
    sellingPricePaise,
    margin,
    markup,
  };
}

test("Margin & Markup Metric Calculations for purchase = 150, selling = 190", () => {
  const result = calculateMarginAndMarkup(150, 190);

  // Purchase Price: Rs 150.00 -> 15000 Paise
  assert.equal(result.purchasePricePaise, 15000);
  
  // Selling Price: Rs 190.00 -> 19000 Paise
  assert.equal(result.sellingPricePaise, 19000);

  // Margin: (190 - 150) / 190 * 100 = 21.0526% -> 21%
  assert.equal(result.margin, 21);

  // Markup: (190 - 150) / 150 * 100 = 26.6666% -> 27%
  assert.equal(result.markup, 27);

  // Ensure all values returned are whole integers compatible with PostgreSQL INTEGER column syntax
  assert.equal(Number.isInteger(result.margin), true);
  assert.equal(Number.isInteger(result.markup), true);
  assert.equal(Number.isInteger(result.purchasePricePaise), true);
  assert.equal(Number.isInteger(result.sellingPricePaise), true);
});
