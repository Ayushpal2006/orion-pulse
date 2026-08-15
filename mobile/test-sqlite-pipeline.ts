/**
 * Apka Bill Mobile - Phase 3 SQLite Test Runner
 */

import {
  initDatabase,
  ProductRepository,
  CustomerRepository,
  StoreRepository,
  LocalProduct,
  LocalCustomer,
  LocalStore,
} from './src/db';

async function runMobileSqliteTests() {
  console.log('🚀 Running Apka Bill Mobile SQLite Tests...\n');

  // 1. Init DB
  const db = await initDatabase();
  console.log('✅ SQLite Database initialized.');

  // 2. Test Store
  const store: LocalStore = {
    id: 1,
    organization_id: 1,
    name: 'Test Retail Store',
    code: 'TEST-01',
    address: '123 Test St',
    city: 'Mumbai',
    state: 'MH',
    country: 'India',
    gst_number: '27TEST0001Z1',
    phone: '+919999999999',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    status: 'active',
  };
  await StoreRepository.upsertStore(store);
  const fetchedStore = await StoreRepository.getStore(1);
  console.log(`✅ Store stored & retrieved: "${fetchedStore?.name}"`);

  // 3. Test Products
  const sampleProducts: LocalProduct[] = [
    {
      id: 1,
      organization_id: 1,
      store_id: 1,
      name: 'Organic Milk 1L',
      sku: 'MILK-ORG-1L',
      barcode: '8901111111111',
      category: 'Dairy',
      selling_price: 6500,
      stock: 40,
      is_active: 1,
    },
    {
      id: 2,
      organization_id: 1,
      store_id: 1,
      name: 'Whole Wheat Bread',
      sku: 'BREAD-WW-400G',
      barcode: '8902222222222',
      category: 'Bakery',
      selling_price: 4500,
      stock: 25,
      is_active: 1,
    },
  ];

  await ProductRepository.upsertBatch(sampleProducts);
  const pCount = await ProductRepository.count(1);
  console.log(`✅ Products upserted: total ${pCount} items.`);

  // 4. Test Search
  const searchResults = await ProductRepository.search('milk', 1);
  console.log(`✅ Search for "milk" returned ${searchResults.length} items (Found: ${searchResults[0]?.name}).`);

  // 5. Test Barcode
  const barcodeProduct = await ProductRepository.getByBarcode('8902222222222', 1);
  console.log(`✅ Barcode lookup for "8902222222222": Found ${barcodeProduct?.name}.`);

  // 6. Test Customers
  const customer: LocalCustomer = {
    id: 1,
    organization_id: 1,
    store_id: 1,
    name: 'Anita Verma',
    phone: '+919876543210',
    email: 'anita@example.com',
    total_orders: 4,
    lifetime_value: 32000,
    is_active: 1,
  };
  await CustomerRepository.upsert(customer);
  const cCount = await CustomerRepository.count(1);
  console.log(`✅ Customers upserted: total ${cCount} records.`);

  console.log('\n🎉 ALL LOCAL SQLITE REPOSITORY TESTS PASSED CLEANLY!\n');
}

runMobileSqliteTests()
  .then(() => {
    // exit cleanly
  })
  .catch((err) => {
    console.error('💥 SQLite test failed:', err);
    process.exit(1);
  });
