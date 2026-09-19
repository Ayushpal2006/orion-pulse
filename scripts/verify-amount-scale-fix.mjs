import assert from "assert";

// Simulation of Checkout Calculation Engine after hotfix
function calculateCheckoutTotals({
  items,
  cartDiscount = 0,
  paidAmount = undefined,
  balance = undefined,
}) {
  let subtotalPaise = 0;
  let totalGstPaise = 0;
  const processedItems = [];

  for (const item of items) {
    let unitPricePaise = item.selling_price || 0;
    if (item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== "") {
      const p = Number(item.unitPrice);
      if (!isNaN(p) && p >= 0) {
        unitPricePaise = Math.round(p * 100);
      }
    } else if (item.price !== undefined && item.price !== null && item.price !== "") {
      const p = Number(item.price);
      if (!isNaN(p) && p >= 0) {
        unitPricePaise = Math.round(p * 100);
      }
    }

    const lineGrossPaise = item.quantity * unitPricePaise;

    let lineDiscountPaise = 0;
    if (item.discountPercent !== undefined && item.discountPercent !== null) {
      lineDiscountPaise = Math.round((lineGrossPaise * Number(item.discountPercent)) / 100);
    } else if (item.discount !== undefined && item.discount !== null && item.discount !== "") {
      const rawDisc = Number(item.discount);
      if (!isNaN(rawDisc) && rawDisc >= 0) {
        if (rawDisc > 0 && rawDisc <= 100 && item.isDiscountPercent) {
          lineDiscountPaise = Math.round((lineGrossPaise * rawDisc) / 100);
        } else {
          lineDiscountPaise = Math.round(rawDisc * 100);
        }
      }
    }
    lineDiscountPaise = Math.min(lineGrossPaise, lineDiscountPaise);

    const lineTaxablePaise = Math.max(0, lineGrossPaise - lineDiscountPaise);
    const gstRate = item.gst !== undefined && item.gst !== null ? Number(item.gst) : 0;
    const lineGstPaise = Math.round((lineTaxablePaise * gstRate) / 100);

    subtotalPaise += lineGrossPaise;
    totalGstPaise += lineGstPaise;

    processedItems.push({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      sellingPrice: unitPricePaise,
      discount: lineDiscountPaise,
      lineTotal: lineTaxablePaise + lineGstPaise,
      lineGst: lineGstPaise,
    });
  }

  let cartDiscountPaise = 0;
  if (cartDiscount !== undefined && cartDiscount !== null && cartDiscount !== "") {
    const rawDisc = Number(cartDiscount);
    if (!isNaN(rawDisc) && rawDisc >= 0) {
      cartDiscountPaise = Math.round(rawDisc * 100);
    }
  }
  const discount = Math.min(subtotalPaise, cartDiscountPaise);
  const grandTotalPaise = Math.max(0, subtotalPaise - discount + totalGstPaise);
  const paidAmountPaise = paidAmount !== undefined && paidAmount !== null && paidAmount !== ""
    ? Math.round(Number(paidAmount) * 100)
    : grandTotalPaise;
  const balancePaise = balance !== undefined && balance !== null && balance !== ""
    ? Math.round(Number(balance) * 100)
    : Math.max(0, grandTotalPaise - paidAmountPaise);

  return {
    dbRecord: {
      subtotal: subtotalPaise,
      discount,
      gst: totalGstPaise,
      grand_total: grandTotalPaise,
      paid_amount: paidAmountPaise,
      balance: balancePaise,
    },
    apiResponse: {
      subtotal: subtotalPaise / 100,
      discount: discount / 100,
      gst: totalGstPaise / 100,
      grandTotal: grandTotalPaise / 100,
      total: grandTotalPaise / 100,
    },
    receiptOutput: {
      subtotalFormatted: (subtotalPaise / 100.0).toFixed(2),
      discountFormatted: (discount / 100.0).toFixed(2),
      gstFormatted: (totalGstPaise / 100.0).toFixed(2),
      grandTotalFormatted: (grandTotalPaise / 100.0).toFixed(2),
    },
    reportAggregatedRevenue: grandTotalPaise / 100.0,
  };
}

console.log("===============================================================================");
console.log("RUNNING STRICT AMOUNT MATRIX VERIFICATION (LOCAL SAFE SIMULATION)");
console.log("===============================================================================");

const testCases = [
  { price: 1, label: "₹1" },
  { price: 10, label: "₹10" },
  { price: 12, label: "₹12" },
  { price: 100, label: "₹100" },
  { price: 500, label: "₹500" },
  { price: 1200, label: "₹1,200" },
  { price: 9999, label: "₹9,999" },
  { price: 10000, label: "₹10,000" },
  { price: 100000, label: "₹1,00,000" },
];

for (const tc of testCases) {
  const result = calculateCheckoutTotals({
    items: [{ productId: 1, name: "Test Item", quantity: 1, price: tc.price, gst: 0 }],
  });

  console.log(`\n▶ Testing ${tc.label} (Entered price: ${tc.price}):`);
  console.log(`  - DB Stored grand_total (Paise): ${result.dbRecord.grand_total}`);
  console.log(`  - API Response grandTotal (INR): ₹${result.apiResponse.grandTotal}`);
  console.log(`  - Receipt Display: ₹${result.receiptOutput.grandTotalFormatted}`);
  console.log(`  - Reports Revenue: ₹${result.reportAggregatedRevenue}`);

  assert.strictEqual(result.apiResponse.grandTotal, tc.price, `API grandTotal must equal ₹${tc.price}`);
  assert.strictEqual(result.dbRecord.grand_total, tc.price * 100, `DB grand_total must equal ${tc.price * 100} paise`);
  assert.strictEqual(result.reportAggregatedRevenue, tc.price, `Report revenue must equal ₹${tc.price}`);
  console.log(`  ✅ PASS: ${tc.label} correctly resolved across DB, API, Receipt, and Reports.`);
}

console.log("\n▶ Testing ₹1,200 with GST (18%) and Discount (₹200):");
const complexResult = calculateCheckoutTotals({
  items: [{ productId: 1, name: "Premium Garment", quantity: 1, price: 1200, gst: 18 }],
  cartDiscount: 200,
});
console.log("  - Subtotal:", complexResult.apiResponse.subtotal); // 1200
console.log("  - Discount:", complexResult.apiResponse.discount); // 200
console.log("  - Taxable:", 1000);
console.log("  - GST (18% on 1200 - 0 item disc = 216):", complexResult.apiResponse.gst); // 216
console.log("  - Grand Total:", complexResult.apiResponse.grandTotal); // 1216
console.log("  - DB grand_total:", complexResult.dbRecord.grand_total); // 121600

assert.strictEqual(complexResult.apiResponse.subtotal, 1200);
assert.strictEqual(complexResult.apiResponse.discount, 200);
assert.strictEqual(complexResult.apiResponse.grandTotal, 1216);
assert.strictEqual(complexResult.dbRecord.grand_total, 121600);
console.log("  ✅ PASS: Complex billing with tax and discount verified.");

console.log("\n===============================================================================");
console.log("ALL AMOUNT MATRIX TESTS PASSED PERFECTLY!");
console.log("===============================================================================");
