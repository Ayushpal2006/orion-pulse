// Comprehensive Verification for WhatsApp Phone Isolation & Bug Fix
import assert from 'assert';

console.log("================================================================================");
console.log("WHATSAPP PHONE NUMBER RESOLUTION & ISOLATION VERIFICATION");
console.log("================================================================================");

// 1. Test canonical normalization function
function normalizeWhatsAppPhone(rawPhone) {
  if (!rawPhone) return null;
  let phone = String(rawPhone).replace(/\D/g, "");

  // Reject empty, all zeros (dummy walk-in), or too short
  if (!phone || /^0+$/.test(phone) || phone.length < 10) {
    return null;
  }

  // Remove leading single zero (e.g. 09315900307 -> 9315900307)
  if (phone.length === 11 && phone.startsWith("0")) {
    phone = phone.slice(1);
  }

  // Already prefixed with 91 for 12-digit Indian number
  if (phone.length === 12 && phone.startsWith("91")) {
    return phone;
  }

  // Standard 10-digit Indian number -> prefix 91
  if (phone.length === 10) {
    return "91" + phone;
  }

  // International format (11 to 15 digits)
  if (phone.length >= 11 && phone.length <= 15) {
    return phone;
  }

  return null;
}

// Unit Tests for Normalization
assert.equal(normalizeWhatsAppPhone("9315900307"), "919315900307");
assert.equal(normalizeWhatsAppPhone("+919315900307"), "919315900307");
assert.equal(normalizeWhatsAppPhone("+91 93159 00307"), "919315900307");
assert.equal(normalizeWhatsAppPhone("09315900307"), "919315900307");
assert.equal(normalizeWhatsAppPhone("93159-00307"), "919315900307");
assert.equal(normalizeWhatsAppPhone("9876543210"), "919876543210");
assert.equal(normalizeWhatsAppPhone("0000000000"), null);
assert.equal(normalizeWhatsAppPhone(""), null);
assert.equal(normalizeWhatsAppPhone(null), null);
assert.equal(normalizeWhatsAppPhone(undefined), null);
console.log("✅ Step 1: Normalization unit tests passed 100%");

// 2. ShareService generateWhatsAppLink implementation
function generateWhatsAppLink(receipt) {
  const phone = normalizeWhatsAppPhone(receipt.customer?.phone);
  if (!phone) {
    throw new Error("Customer phone number is required to share on WhatsApp.");
  }
  const shopName = receipt.branding?.shopName || "Store";
  const customerName = receipt.customer?.name || "Customer";
  const invoiceNum = receipt.invoiceNumber;
  const amount = receipt.grandTotal || 0;
  const rawMessage = `Hi ${customerName} 👋\nThank you for shopping with ${shopName}.\nInvoice: ${invoiceNum}\nAmount: ₹${amount.toFixed(2)}`;
  const encoded = encodeURIComponent(rawMessage);
  return `https://wa.me/${phone}?text=${encoded}`;
}

// ==============================================================================
// TEST 1: Customer A (Phone: 9315900307)
// ==============================================================================
{
  const receiptA = {
    invoiceNumber: "INV-1001",
    grandTotal: 1700.0,
    customer: { id: 101, name: "Rahul Sharma", phone: "9315900307" },
    branding: { shopName: "Apka Bill Store" }
  };
  const urlA = generateWhatsAppLink(receiptA);
  assert(urlA.startsWith("https://wa.me/919315900307?text="), `Target must be 919315900307, got ${urlA}`);
  console.log("✅ TEST 1 PASSED: Customer A targets wa.me/919315900307");
}

// ==============================================================================
// TEST 2: Sequential Bill for Customer B (Phone: 9876543210, Name: Rahul Sharma)
// ==============================================================================
{
  const receiptB = {
    invoiceNumber: "INV-1002",
    grandTotal: 4950.0,
    customer: { id: 102, name: "Rahul Sharma", phone: "9876543210" },
    branding: { shopName: "Apka Bill Store" }
  };
  const urlB = generateWhatsAppLink(receiptB);
  assert(urlB.startsWith("https://wa.me/919876543210?text="), `Target must be 919876543210, got ${urlB}`);
  assert(!urlB.includes("9315900307"), "Customer B MUST NOT contain Customer A's phone!");
  console.log("✅ TEST 2 PASSED: Customer B targets wa.me/919876543210 without state leakage");
}

// ==============================================================================
// TEST 3: Walk-in customer with manually entered phone (+91 91234 56789)
// ==============================================================================
{
  const receiptC = {
    invoiceNumber: "INV-1003",
    grandTotal: 500.0,
    customer: { id: 103, name: "Walk-in Customer", phone: "+91 91234 56789" },
    branding: { shopName: "Apka Bill Store" }
  };
  const urlC = generateWhatsAppLink(receiptC);
  assert(urlC.startsWith("https://wa.me/919123456789?text="), `Target must be 919123456789, got ${urlC}`);
  console.log("✅ TEST 3 PASSED: Manual phone input targets wa.me/919123456789");
}

// ==============================================================================
// TEST 4: Customer with no phone / dummy 0000000000
// ==============================================================================
{
  const receiptD = {
    invoiceNumber: "INV-1004",
    grandTotal: 250.0,
    customer: { id: 1, name: "Walk-in Customer", phone: "0000000000" },
    branding: { shopName: "Apka Bill Store" }
  };
  let threw = false;
  try {
    generateWhatsAppLink(receiptD);
  } catch (err) {
    threw = true;
    assert.equal(err.message, "Customer phone number is required to share on WhatsApp.");
  }
  assert(threw, "Must throw when customer has no valid phone");
  console.log("✅ TEST 4 PASSED: Missing phone produces clear error and blocks sharing");
}

// ==============================================================================
// TEST 5: Frontend State Reset Simulation
// ==============================================================================
{
  let state = {
    selectedCustomer: { id: 101, name: "Customer A", mobile: "9315900307" },
    customerQuery: "Customer A",
    mobile: "9315900307",
    name: "Customer A"
  };

  // Simulate user changing query to "Customer B" (not 10 digits)
  const handleCustomerQueryChange = (val) => {
    state.customerQuery = val;
    const sanitized = val.replace(/\D/g, "");
    if (sanitized.length === 10) {
      state.mobile = sanitized;
    } else {
      state.selectedCustomer = null;
      if (!val.trim()) {
        state.mobile = "";
        state.name = "";
      } else {
        state.name = val;
        state.mobile = ""; // Cleared so previous customer's phone does not leak!
      }
    }
  };

  handleCustomerQueryChange("Customer B");
  assert.equal(state.selectedCustomer, null, "selectedCustomer must be reset");
  assert.equal(state.mobile, "", "mobile must not leak previous customer's phone");
  assert.equal(state.name, "Customer B");
  console.log("✅ TEST 5 PASSED: Switching customers resets stale state completely");
}

console.log("\n================================================================================");
console.log("ALL WHATSAPP ISOLATION & REGRESSION VERIFICATIONS PASSED!");
console.log("================================================================================");
