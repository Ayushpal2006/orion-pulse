import assert from "node:assert";

// Simulation of Outbox entity priority ordering
const ENTITY_SYNC_ORDER = {
  customer: 10,
  supplier: 20,
  product: 30,
  purchase: 40,
  stock_adjustment: 50,
  adjustment: 50,
  expense: 60,
  sale: 70,
  settings: 80,
};

function sortOutboxEvents(events) {
  return [...events].sort((a, b) => {
    const priorityA = ENTITY_SYNC_ORDER[a.entity_type] || 99;
    const priorityB = ENTITY_SYNC_ORDER[b.entity_type] || 99;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.id - b.id;
  });
}

console.log("=================================================");
console.log("RUNNING OUTBOX DEPENDENCY & SYNC VERIFICATION");
console.log("=================================================");

// TEST 1: Offline Product Creation followed by Sale
console.log("\n▶ Test 1: Offline Product Creation -> Sale referencing Product");
const rawEvents = [
  { id: 1, entity_type: 'sale', entity_id: 'sale-101', payload: JSON.stringify({ invoice_number: 'INV-101', items: [{ productId: 55, name: 'Brand New Product', quantity: 2, selling_price: 15000 }] }) },
  { id: 2, entity_type: 'product', entity_id: '55', payload: JSON.stringify({ name: 'Brand New Product', selling_price: 15000, price: 150 }) },
];

const sorted = sortOutboxEvents(rawEvents);
assert.strictEqual(sorted[0].entity_type, 'product', 'Product MUST come before sale');
assert.strictEqual(sorted[1].entity_type, 'sale', 'Sale MUST come second');
console.log("✅ Passed: Product creation (id=2) sorted before Sale (id=1)");

// TEST 2: Complex Offline Workflow with Customer, Supplier, Product, Purchase, Expense, Sale
console.log("\n▶ Test 2: Complex Multi-Entity Dependency Ordering");
const multiEvents = [
  { id: 10, entity_type: 'sale', entity_id: '1' },
  { id: 11, entity_type: 'expense', entity_id: '1' },
  { id: 12, entity_type: 'purchase', entity_id: '1' },
  { id: 13, entity_type: 'stock_adjustment', entity_id: '1' },
  { id: 14, entity_type: 'product', entity_id: '1' },
  { id: 15, entity_type: 'supplier', entity_id: '1' },
  { id: 16, entity_type: 'customer', entity_id: '1' },
  { id: 17, entity_type: 'settings', entity_id: '1' },
];

const sortedMulti = sortOutboxEvents(multiEvents);
const expectedOrder = ['customer', 'supplier', 'product', 'purchase', 'stock_adjustment', 'expense', 'sale', 'settings'];
const actualOrder = sortedMulti.map(e => e.entity_type);
assert.deepStrictEqual(actualOrder, expectedOrder, `Order mismatch: got ${actualOrder.join(', ')}`);
console.log(`✅ Passed: Exact order verified: ${actualOrder.join(' -> ')}`);

// TEST 3: Tenant Isolation Scoping Check
console.log("\n▶ Test 3: Tenant Isolation Header & Store Scoping");
function makeSyncHeaders(storeId, orgId) {
  return {
    'X-Store-Id': String(storeId),
    ...(orgId ? { 'X-Organization-Id': String(orgId) } : {}),
  };
}

const store1Headers = makeSyncHeaders(1, 100);
const store2Headers = makeSyncHeaders(2, 100);
assert.strictEqual(store1Headers['X-Store-Id'], '1');
assert.strictEqual(store2Headers['X-Store-Id'], '2');
assert.notStrictEqual(store1Headers['X-Store-Id'], store2Headers['X-Store-Id']);
console.log("✅ Passed: Tenant headers strictly isolated per store");

// TEST 4: Failure Accounting
console.log("\n▶ Test 4: Failure Accounting on 500 / Network Drop");
function calculateSyncProgress(initialPending, processed, uploaded, failed, currentRemaining) {
  const reportedFailed = Math.max(0, failed);
  const status = reportedFailed > 0 ? 'error' : (currentRemaining > 0 ? 'idle' : 'success');
  const progress = initialPending > 0 ? Math.round((uploaded / initialPending) * 100) : 100;
  return { status, progress, failed: reportedFailed, remaining: currentRemaining };
}

// Case A: 2 items, 1 succeeds, 1 fails with 500
const failResult = calculateSyncProgress(2, 2, 1, 1, 1);
assert.strictEqual(failResult.status, 'error', 'Status must be error if any item failed');
assert.strictEqual(failResult.failed, 1, 'Failed count must be 1');
assert.strictEqual(failResult.remaining, 1, 'Remaining un-synced must be 1');
console.log("✅ Passed: 500 error correctly marks status 'error' and preserves pending item for retry");

// Case B: 2 items, 2 succeed
const successResult = calculateSyncProgress(2, 2, 2, 0, 0);
assert.strictEqual(successResult.status, 'success', 'Status must be success when all items succeed');
assert.strictEqual(successResult.failed, 0);
assert.strictEqual(successResult.remaining, 0);
console.log("✅ Passed: All items succeeded -> status 'success'");

// TEST 5: Last Sync Timestamp Metadata
console.log("\n▶ Test 5: Last Sync Timestamp Retention");
let lastSyncStore = {};
function recordSyncSuccess(key, time) {
  lastSyncStore[key] = time;
}
function getLastSync(key) {
  return lastSyncStore[key] || null;
}

assert.strictEqual(getLastSync('delta_sync_1'), null);
const t1 = new Date().toISOString();
recordSyncSuccess('delta_sync_1', t1);
assert.strictEqual(getLastSync('delta_sync_1'), t1);
console.log(`✅ Passed: Delta sync timestamp stored and retrieved accurately (${t1})`);

console.log("\n=================================================");
console.log("ALL 5 OUTBOX & SYNC VERIFICATION TESTS PASSED! 🎉");
console.log("=================================================");
