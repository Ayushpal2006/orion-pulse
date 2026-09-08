import assert from "node:assert";

// Universal price resolution logic (from frontend/src/lib/price-utils.ts)
function resolveProductSellingPrice(prod) {
  if (!prod || typeof prod !== "object") {
    return 0;
  }

  // 1. Canonical frontend `price` field (already in Rupees)
  if (prod.price !== undefined && prod.price !== null && prod.price !== "") {
    const val = Number(prod.price);
    if (!isNaN(val) && val >= 0) {
      return val;
    }
  }

  // 2. camelCase `unitPrice` or snake_case `unit_price` (in Rupees)
  const unitPriceCandidate = prod.unitPrice ?? prod.unit_price;
  if (unitPriceCandidate !== undefined && unitPriceCandidate !== null && unitPriceCandidate !== "") {
    const val = Number(unitPriceCandidate);
    if (!isNaN(val) && val >= 0) {
      return val;
    }
  }

  // 3. camelCase `sellingPrice` (in Rupees)
  if (prod.sellingPrice !== undefined && prod.sellingPrice !== null && prod.sellingPrice !== "") {
    const val = Number(prod.sellingPrice);
    if (!isNaN(val) && val >= 0) {
      return val;
    }
  }

  // 4. snake_case `selling_price`
  if (prod.selling_price !== undefined && prod.selling_price !== null && prod.selling_price !== "") {
    const val = Number(prod.selling_price);
    if (!isNaN(val) && val >= 0) {
      if (prod.purchase_price !== undefined && prod.price === undefined) {
        return val / 100;
      }
      return val;
    }
  }

  return 0;
}

// Backend price resolution logic (from backend/src/services/sales.service.ts)
function resolveBackendSellingPricePaise(itemRequest, dbProduct) {
  let sellingPricePaise = dbProduct.selling_price;
  if (itemRequest.unitPrice !== undefined && itemRequest.unitPrice !== null && itemRequest.unitPrice !== "") {
    const p = Number(itemRequest.unitPrice);
    if (!isNaN(p) && p >= 0) {
      sellingPricePaise = Math.round(p * 100);
    }
  } else if (itemRequest.price !== undefined && itemRequest.price !== null && itemRequest.price !== "") {
    const p = Number(itemRequest.price);
    if (!isNaN(p) && p >= 0) {
      sellingPricePaise = Math.round(p * 100);
    }
  } else if (itemRequest.selling_price !== undefined && itemRequest.selling_price !== null && itemRequest.selling_price !== "") {
    const p = Number(itemRequest.selling_price);
    if (!isNaN(p) && p >= 0) {
      sellingPricePaise = Math.round(p > 1000 ? p : p * 100);
    }
  }
  return sellingPricePaise;
}

console.log("=================================================");
console.log("RUNNING EDIT BILL PRICE RESOLUTION VERIFICATION");
console.log("=================================================");

// TEST 1: Add ₹350 product
console.log("\n▶ Test 1: Add ₹350 product");
const prod350 = { id: 1, name: "Premium Tea 500g", price: 350, stock: 20 };
const price1 = resolveProductSellingPrice(prod350);
assert.strictEqual(price1, 350, "Test 1 Failed: Price should be 350");
console.log(`✅ Passed: resolved price = ₹${price1}`);

// TEST 2: Add ₹250 product
console.log("\n▶ Test 2: Add ₹250 product");
const prod250 = { id: 2, name: "Coffee 200g", price: 250, stock: 15 };
const price2 = resolveProductSellingPrice(prod250);
assert.strictEqual(price2, 250, "Test 2 Failed: Price should be 250");
console.log(`✅ Passed: resolved price = ₹${price2}`);

// TEST 3: Add ₹0 product intentionally
console.log("\n▶ Test 3: Add ₹0 product intentionally");
const prodFree = { id: 3, name: "Promotional Bag", price: 0, stock: 100 };
const price3 = resolveProductSellingPrice(prodFree);
assert.strictEqual(price3, 0, "Test 3 Failed: ₹0 price must be preserved as 0");
console.log(`✅ Passed: resolved price = ₹${price3}`);

// TEST 4: Product comes from SQLite / offline storage (raw paise)
console.log("\n▶ Test 4: Product from SQLite / offline storage (selling_price: 35000 paise, purchase_price: 20000 paise)");
const prodSqlite = { id: 4, name: "Basmati Rice 5kg", selling_price: 35000, purchase_price: 20000, stock: 10 };
const price4 = resolveProductSellingPrice(prodSqlite);
assert.strictEqual(price4, 350, "Test 4 Failed: Raw SQLite selling_price in paise must convert to 350 Rupees");
console.log(`✅ Passed: resolved price = ₹${price4}`);

// TEST 5: Product after API sync / mapBackendProductToFrontend (price: 350, selling_price: 350)
console.log("\n▶ Test 5: Product after API sync / mapped frontend product");
const prodMapped = { id: 5, name: "Olive Oil 1L", price: 350, selling_price: 350, sellingPrice: 350, stock: 8 };
const price5 = resolveProductSellingPrice(prodMapped);
assert.strictEqual(price5, 350, "Test 5 Failed: Mapped product must resolve to 350 Rupees");
console.log(`✅ Passed: resolved price = ₹${price5}`);

// TEST 6: Product price received as string ("350" and "250.50")
console.log("\n▶ Test 6: String price inputs ('350', '250.50')");
const prodStringInt = { id: 6, name: "Widget A", price: "350" };
const prodStringFloat = { id: 7, name: "Widget B", price: "250.50" };
assert.strictEqual(resolveProductSellingPrice(prodStringInt), 350, "Test 6a Failed");
assert.strictEqual(resolveProductSellingPrice(prodStringFloat), 250.50, "Test 6b Failed");
console.log("✅ Passed: string prices converted to numbers accurately");

// TEST 7: Change quantity 1 -> 2 -> 3 -> line total updates
console.log("\n▶ Test 7: Quantity changes 1 -> 2 -> 3 recalculate line total");
let item = { productId: 1, name: "Tea", price: 350, qty: 1, discount: 0 };
let lineTotal1 = (item.price - item.discount) * item.qty;
assert.strictEqual(lineTotal1, 350, "Qty 1 line total must be 350");

item.qty = 2;
let lineTotal2 = (item.price - item.discount) * item.qty;
assert.strictEqual(lineTotal2, 700, "Qty 2 line total must be 700");

item.qty = 3;
let lineTotal3 = (item.price - item.discount) * item.qty;
assert.strictEqual(lineTotal3, 1050, "Qty 3 line total must be 1050");
console.log(`✅ Passed: line totals at qty 1: ₹${lineTotal1}, qty 2: ₹${lineTotal2}, qty 3: ₹${lineTotal3}`);

// TEST 8: Full bill calculations: subtotal, discount, tax, grand total, and item removal
console.log("\n▶ Test 8: Subtotal, Discount, Tax, Grand Total, and Removal");
let billItems = [
  { productId: 1, name: "Tea", price: 350, qty: 2, discount: 0, gst: 18 }, // 700 + 126 gst
  { productId: 2, name: "Coffee", price: 250, qty: 1, discount: 0, gst: 18 }, // 250 + 45 gst
];
let overallDiscount = 50;

function calcBill(items, disc) {
  const subtotal = items.reduce((acc, it) => acc + (it.price - it.discount) * it.qty, 0);
  const totalTax = items.reduce((acc, it) => acc + ((it.price - it.discount) * it.qty * (it.gst || 0)) / 100, 0);
  const grandTotal = Math.max(0, subtotal - disc + totalTax);
  return { subtotal, totalTax, grandTotal };
}

let billTotals = calcBill(billItems, overallDiscount);
assert.strictEqual(billTotals.subtotal, 950, "Subtotal should be 700 + 250 = 950");
assert.strictEqual(billTotals.totalTax, 171, "Total Tax should be 126 + 45 = 171");
assert.strictEqual(billTotals.grandTotal, 1071, "Grand Total should be 950 - 50 + 171 = 1071");
console.log(`✅ Initial bill: Subtotal ₹${billTotals.subtotal}, Tax ₹${billTotals.totalTax}, Grand Total ₹${billTotals.grandTotal}`);

// Remove second item
billItems = billItems.filter((it) => it.productId !== 2);
let afterRemovalTotals = calcBill(billItems, overallDiscount);
assert.strictEqual(afterRemovalTotals.subtotal, 700, "Subtotal after removal should be 700");
assert.strictEqual(afterRemovalTotals.totalTax, 126, "Tax after removal should be 126");
assert.strictEqual(afterRemovalTotals.grandTotal, 776, "Grand Total after removal should be 700 - 50 + 126 = 776");
console.log(`✅ After removal: Subtotal ₹${afterRemovalTotals.subtotal}, Tax ₹${afterRemovalTotals.totalTax}, Grand Total ₹${afterRemovalTotals.grandTotal}`);

// TEST 9: Backend editInvoice persistence simulation
console.log("\n▶ Test 9: Backend editInvoice selling price persistence");
const dbCatalogProduct = { id: 1, name: "Tea", selling_price: 35000, gst: 18 }; // 35000 paise = 350 INR

// Request with newly added product sending unitPrice: 350
const itemPayloadNew = { productId: 1, quantity: 2, discount: 0, unitPrice: 350 };
const persistedPaiseNew = resolveBackendSellingPricePaise(itemPayloadNew, dbCatalogProduct);
assert.strictEqual(persistedPaiseNew, 35000, "Backend must persist 35000 paise for ₹350 unitPrice");
console.log(`✅ Passed: backend received unitPrice ₹350 -> persisted selling_price ${persistedPaiseNew} paise`);

// Request with preserved custom old price (e.g. ₹320 on an old bill)
const itemPayloadOld = { productId: 1, quantity: 1, discount: 0, unitPrice: 320 };
const persistedPaiseOld = resolveBackendSellingPricePaise(itemPayloadOld, dbCatalogProduct);
assert.strictEqual(persistedPaiseOld, 32000, "Backend must preserve old price ₹320 as 32000 paise");
console.log(`✅ Passed: backend preserved custom price ₹320 -> persisted selling_price ${persistedPaiseOld} paise`);

// Request with intentional ₹0 price
const itemPayloadZero = { productId: 1, quantity: 1, discount: 0, unitPrice: 0 };
const persistedPaiseZero = resolveBackendSellingPricePaise(itemPayloadZero, dbCatalogProduct);
assert.strictEqual(persistedPaiseZero, 0, "Backend must persist 0 paise for intentional ₹0");
console.log(`✅ Passed: backend preserved ₹0 -> persisted selling_price ${persistedPaiseZero} paise`);

// TEST 10: Reopen edited bill receipt mapping
console.log("\n▶ Test 10: Reopen edited bill receipt mapping");
// Backend getReceipt returns items with price = selling_price / 100.0
const reloadedReceiptItem = {
  productId: 1,
  name: "Tea",
  qty: 2,
  price: persistedPaiseNew / 100.0, // 350.0
  discount: 0,
};
const reopenedPrice = resolveProductSellingPrice(reloadedReceiptItem);
assert.strictEqual(reopenedPrice, 350, "Reopened receipt price must still be 350");
console.log(`✅ Passed: reopened bill shows price ₹${reopenedPrice}`);

console.log("\n=================================================");
console.log("ALL 10 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉");
console.log("=================================================");
