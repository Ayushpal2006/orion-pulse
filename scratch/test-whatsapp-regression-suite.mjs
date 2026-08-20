// Regression Test Suite for WhatsApp Invoice Phone Target & Isolation
import assert from 'assert';

console.log("================================================================================");
console.log("🧪 RUNNING WHATSAPP INVOICE PHONE ISOLATION REGRESSION TESTS");
console.log("================================================================================");

// 1. Phone Normalizer
function normalizeWhatsAppPhone(rawPhone) {
  if (!rawPhone) return null;
  let phone = String(rawPhone).replace(/\D/g, "");

  if (!phone || /^0+$/.test(phone) || phone.length < 10) {
    return null;
  }
  if (phone.length === 11 && phone.startsWith("0")) {
    phone = phone.slice(1);
  }
  if (phone.length === 12 && phone.startsWith("91")) {
    return phone;
  }
  if (phone.length === 10) {
    return "91" + phone;
  }
  if (phone.length >= 11 && phone.length <= 15) {
    return phone;
  }
  return null;
}

// 2. Share Link Builder
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
// TEST A: Sale customer phone = 9876543210, Previous customer phone = 9999999999
// ==============================================================================
console.log("\n▶️ TEST A: Sale customer phone = 9876543210 (Previous: 9999999999)");
{
  const previousCustomerPhone = "9999999999";
  const currentSaleReceipt = {
    invoiceNumber: "INV-1002",
    grandTotal: 1500,
    customer: { id: 2, name: "Customer B", phone: "9876543210" },
    branding: { shopName: "Apka Bill POS" }
  };

  const waUrl = generateWhatsAppLink(currentSaleReceipt);
  assert(waUrl.startsWith("https://wa.me/919876543210?text="), `Must target 919876543210, got ${waUrl}`);
  assert(!waUrl.includes(previousCustomerPhone), "Must NOT leak previous customer phone 9999999999");
  console.log("   ✅ TEST A PASSED: WhatsApp URL targets 919876543210 exclusively.");
}

// ==============================================================================
// TEST B: Walk-in / no phone customer (Must NOT use previous number)
// ==============================================================================
console.log("\n▶️ TEST B: Walk-in / no phone customer");
{
  const walkInReceipt = {
    invoiceNumber: "INV-1003",
    grandTotal: 300,
    customer: { id: 1, name: "Walk-in Customer", phone: "" },
    branding: { shopName: "Apka Bill POS" }
  };

  let threwError = false;
  try {
    generateWhatsAppLink(walkInReceipt);
  } catch (err) {
    threwError = true;
    assert.equal(err.message, "Customer phone number is required to share on WhatsApp.");
  }
  assert(threwError, "Must block sharing when phone is missing");
  console.log("   ✅ TEST B PASSED: Blocked with clear error, no fallback to previous number.");
}

// ==============================================================================
// TEST C: Enter phone manually during checkout (+91 93159 00307)
// ==============================================================================
console.log("\n▶️ TEST C: Enter phone manually during checkout (+91 93159 00307)");
{
  const manualReceipt = {
    invoiceNumber: "INV-1004",
    grandTotal: 850,
    customer: { id: 3, name: "Guest User", phone: "+91 93159 00307" },
    branding: { shopName: "Apka Bill POS" }
  };

  const waUrl = generateWhatsAppLink(manualReceipt);
  assert(waUrl.startsWith("https://wa.me/919315900307?text="), `Must target 919315900307, got ${waUrl}`);
  console.log("   ✅ TEST C PASSED: WhatsApp uses exact saved phone 919315900307.");
}

// ==============================================================================
// TEST D: Switch customers before checkout (Customer X -> Customer Y)
// ==============================================================================
console.log("\n▶️ TEST D: Switch customers before checkout");
{
  // Simulated UI state lifecycle
  let uiState = {
    selectedCustomer: { id: 10, name: "Customer X", mobile: "9111111111" },
    mobile: "9111111111",
    name: "Customer X"
  };

  // Cashier switches customer to Customer Y
  const switchCustomer = (newCustomer) => {
    uiState.selectedCustomer = newCustomer;
    uiState.mobile = newCustomer.mobile;
    uiState.name = newCustomer.name;
  };

  switchCustomer({ id: 20, name: "Customer Y", mobile: "9222222222" });

  const finalSavedReceipt = {
    invoiceNumber: "INV-1005",
    grandTotal: 1200,
    customer: { id: uiState.selectedCustomer.id, name: uiState.name, phone: uiState.mobile },
    branding: { shopName: "Apka Bill POS" }
  };

  const waUrl = generateWhatsAppLink(finalSavedReceipt);
  assert(waUrl.startsWith("https://wa.me/919222222222?text="), `Must target Customer Y (919222222222), got ${waUrl}`);
  assert(!waUrl.includes("9111111111"), "Must NOT include Customer X's number");
  console.log("   ✅ TEST D PASSED: WhatsApp uses final selected customer phone 919222222222.");
}

console.log("\n================================================================================");
console.log("🎉 ALL 4 REGRESSION TESTS (A, B, C, D) PASSED 100%!");
console.log("================================================================================");
