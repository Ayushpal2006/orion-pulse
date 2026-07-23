import test from "node:test";
import assert from "node:assert/strict";
import { inventoryCostService } from "../services/inventory-cost.service";

test("InventoryCostService - Case A: New product (currentStock = 0)", () => {
  const result = inventoryCostService.calculateCostAfterPurchase(
    {
      id: 1,
      name: "New Product",
      stock: 0,
      average_cost: 0,
      selling_price: 20000, // Rs 200.00
    },
    {
      quantity: 10,
      purchase_price: 15000, // Rs 150.00
    }
  );

  assert.equal(result.average_cost, 15000);
  assert.equal(result.last_purchase_cost, 15000);
  assert.equal(result.selling_price, 20000);
  assert.equal(result.margin_percent, 25); // (200 - 150) / 200 * 100 = 25%
  assert.equal(result.markup_percent, 33); // (200 - 150) / 150 * 100 = 33.33 -> 33%
});

test("InventoryCostService - Case B: Zero-cost legacy inventory (currentStock > 0, avgCost = 0)", () => {
  const result = inventoryCostService.calculateCostAfterPurchase(
    {
      id: 2,
      name: "Legacy Product Zero Cost",
      stock: 46,
      average_cost: 0,
      selling_price: 19000, // Rs 190.00
    },
    {
      quantity: 5,
      purchase_price: 15000, // Rs 150.00
    }
  );

  // Must NOT use weighted average with 0 (which produced 319 paise)
  assert.equal(result.average_cost, 15000);
  assert.equal(result.last_purchase_cost, 15000);
  assert.equal(result.margin_percent, 21); // (190 - 150) / 190 * 100 = 21%
  assert.equal(result.markup_percent, 27); // (190 - 150) / 150 * 100 = 27%
});

test("InventoryCostService - Case C: Normal weighted average (currentStock > 0, avgCost > 0)", () => {
  // Existing: 10 units @ 10,000 Paise (Rs 100.00)
  // New Purchase: 10 units @ 20,000 Paise (Rs 200.00)
  // New Avg Cost = ((10 * 10000) + (10 * 20000)) / 20 = 300,000 / 20 = 15,000 Paise (Rs 150.00)
  const result = inventoryCostService.calculateCostAfterPurchase(
    {
      id: 3,
      name: "Existing Product",
      stock: 10,
      average_cost: 10000,
      selling_price: 25000,
    },
    {
      quantity: 10,
      purchase_price: 20000,
    }
  );

  assert.equal(result.average_cost, 15000);
  assert.equal(result.last_purchase_cost, 20000);
  assert.equal(result.margin_percent, 40); // (250 - 150) / 250 * 100 = 40%
  assert.equal(result.markup_percent, 67); // (250 - 150) / 150 * 100 = 66.66 -> 67%
});

test("InventoryCostService - Multiple sequential purchases cost evolution", () => {
  let productState = {
    id: 4,
    name: "Sequential Test Product",
    stock: 0,
    average_cost: 0,
    selling_price: 30000,
  };

  // Purchase 1: 10 units @ 100.00 Rs (10000 Paise)
  const p1 = inventoryCostService.calculateCostAfterPurchase(
    productState,
    { quantity: 10, purchase_price: 10000 }
  );
  assert.equal(p1.average_cost, 10000);

  // Update product state
  productState.stock = 10;
  productState.average_cost = p1.average_cost;

  // Purchase 2: 10 units @ 200.00 Rs (20000 Paise)
  const p2 = inventoryCostService.calculateCostAfterPurchase(
    productState,
    { quantity: 10, purchase_price: 20000 }
  );
  assert.equal(p2.average_cost, 15000); // (100000 + 200000) / 20 = 15000

  // Update product state
  productState.stock = 20;
  productState.average_cost = p2.average_cost;

  // Purchase 3: 20 units @ 300.00 Rs (30000 Paise)
  const p3 = inventoryCostService.calculateCostAfterPurchase(
    productState,
    { quantity: 20, purchase_price: 30000 }
  );
  // (20 * 15000 + 20 * 30000) / 40 = 900,000 / 40 = 22,500 Paise (Rs 225.00)
  assert.equal(p3.average_cost, 22500);
  assert.equal(p3.last_purchase_cost, 30000);
});

test("InventoryCostService - Validation error assertions for negative values", () => {
  assert.throws(() => {
    inventoryCostService.calculateCostAfterPurchase(
      { stock: -5, average_cost: 100, selling_price: 200 },
      { quantity: 5, purchase_price: 150 }
    );
  }, /Invalid product stock/);

  assert.throws(() => {
    inventoryCostService.calculateCostAfterPurchase(
      { stock: 5, average_cost: -100, selling_price: 200 },
      { quantity: 5, purchase_price: 150 }
    );
  }, /Invalid average cost/);

  assert.throws(() => {
    inventoryCostService.calculateCostAfterPurchase(
      { stock: 5, average_cost: 100, selling_price: 200 },
      { quantity: 5, purchase_price: 0 }
    );
  }, /Invalid purchase price/);
});
