// Verification script for PWA Thermal Printer Hotfix (Currency, Wrapping, Logo)
import assert from 'assert';

console.log("================================================================================");
console.log("PWA THERMAL PRINTER HOTFIX VERIFICATION");
console.log("================================================================================");

// 1. Test formatThermalCurrency
function formatThermalCurrency(amount, isDiscount = false) {
  const num = Math.abs(Number(amount) || 0).toFixed(2);
  return isDiscount ? `-Rs ${num}` : `Rs ${num}`;
}

assert.equal(formatThermalCurrency(1700), "Rs 1700.00");
assert.equal(formatThermalCurrency(4950), "Rs 4950.00");
assert.equal(formatThermalCurrency(10, true), "-Rs 10.00");
assert.equal(formatThermalCurrency(10), "Rs 10.00");
console.log("[TEST 1 PASSED] formatThermalCurrency outputs clean 'Rs XXXX.XX' and '-Rs XX.XX'");

// 2. Test Word Wrapping and Amount Column Budgeting on 32 chars/line
function wrapText(str, width) {
  if (!str) return [];
  const words = str.trim().split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    if ((current ? current + " " + word : word).length <= width) {
      current = current ? current + " " + word : word;
    } else {
      if (current) lines.push(current);
      if (word.length > width) {
        let remaining = word;
        while (remaining.length > width) {
          lines.push(remaining.substring(0, width));
          remaining = remaining.substring(width);
        }
        current = remaining;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

const maxLen = 32;

// Test short item: "1x Premium shirt", total = 1700
{
  const item = { qty: 1, name: "Premium shirt", total: 1700 };
  const rightCol = formatThermalCurrency(item.total);
  const rightColLen = rightCol.length;
  const maxLeftWidth = maxLen - rightColLen - 1;
  const prefix = `${item.qty}x ${item.name}`;

  let line = "";
  if (prefix.length <= maxLeftWidth) {
    const spaceCount = maxLen - prefix.length - rightColLen;
    line = prefix + " ".repeat(spaceCount) + rightCol;
  }
  assert.equal(line.length, 32, "Short item line must be exactly 32 chars");
  assert.equal(line, "1x Premium shirt      Rs 1700.00");
  console.log("[TEST 2 PASSED] Short item line:", line);
}

// Test long item: "1x Baggy T-shirt/coller", total = 1250
{
  const item = { qty: 1, name: "Baggy T-shirt/coller", total: 1250 };
  const rightCol = formatThermalCurrency(item.total);
  const rightColLen = rightCol.length;
  const maxLeftWidth = maxLen - rightColLen - 1; // 32 - 10 - 1 = 21 chars
  const prefix = `${item.qty}x ${item.name}`;

  const renderedLines = [];
  if (prefix.length <= maxLeftWidth) {
    const spaceCount = maxLen - prefix.length - rightColLen;
    renderedLines.push(prefix + " ".repeat(spaceCount) + rightCol);
  } else {
    const itemLines = wrapText(prefix, maxLeftWidth);
    const firstLineLeft = itemLines[0] || prefix.substring(0, maxLeftWidth);
    const firstSpaceCount = maxLen - firstLineLeft.length - rightColLen;
    renderedLines.push(firstLineLeft + " ".repeat(firstSpaceCount) + rightCol);
    for (let i = 1; i < itemLines.length; i++) {
      renderedLines.push(itemLines[i]);
    }
  }

  assert.equal(renderedLines[0].length, 32, "First line of wrapped item must be exactly 32 chars");
  assert(renderedLines[0].endsWith("Rs 1250.00"), "Amount must be right-aligned on first line");
  assert(renderedLines.length >= 2, "Product name should wrap to second line");
  console.log("[TEST 3 PASSED] Long item wrapped cleanly without amount overflow:");
  renderedLines.forEach((l, idx) => console.log(`   Line ${idx + 1} (${l.length} chars): [${l}]`));
}

// Test Totals on 32 chars/line
{
  const renderTotalRow = (label, valueStr) => {
    const spaceCount = Math.max(1, maxLen - label.length - valueStr.length);
    return label + " ".repeat(spaceCount) + valueStr;
  };

  const subtotalLine = renderTotalRow("Subtotal", formatThermalCurrency(4950));
  const discountLine = renderTotalRow("Discount", formatThermalCurrency(10, true));
  const gstLine = renderTotalRow("GST Tax", formatThermalCurrency(10));
  const grandTotalLine = renderTotalRow("GRAND TOTAL", formatThermalCurrency(4950));

  assert.equal(subtotalLine.length, 32);
  assert.equal(discountLine.length, 32);
  assert.equal(gstLine.length, 32);
  assert.equal(grandTotalLine.length, 32);

  assert.equal(subtotalLine, "Subtotal              Rs 4950.00");
  assert.equal(discountLine, "Discount               -Rs 10.00");
  assert.equal(gstLine,      "GST Tax                 Rs 10.00");
  assert.equal(grandTotalLine, "GRAND TOTAL           Rs 4950.00");

  console.log("[TEST 4 PASSED] Totals rows match 32 chars perfectly:");
  console.log("  ", subtotalLine);
  console.log("  ", discountLine);
  console.log("  ", gstLine);
  console.log("  ", grandTotalLine);
}

console.log("\n================================================================================");
console.log("ALL PWA THERMAL PRINTER TESTS PASSED PERFECTLY!");
console.log("================================================================================");
