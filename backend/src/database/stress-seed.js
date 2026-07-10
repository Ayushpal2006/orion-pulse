const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "../../database/orion.db");
console.log(`Connecting to database at: ${dbPath}`);
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("⏳ Running stress seeder. This will clean products, customers, sales, and sale_items...");

const run = db.transaction(() => {
  // Clear existing records (preserving settings)
  db.prepare("DELETE FROM sale_items").run();
  db.prepare("DELETE FROM sales").run();
  db.prepare("DELETE FROM customers").run();
  db.prepare("DELETE FROM products").run();
  db.prepare("DELETE FROM sync_jobs").run();

  // Reset autoincrement sequences
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('products', 'customers', 'sales', 'sale_items', 'sync_jobs')").run();

  // 1. Seed 500 Products
  console.log("📦 Generating 500 products...");
  const insertProduct = db.prepare(`
    INSERT INTO products (name, sku, barcode, category, purchase_price, selling_price, stock, minimum_stock, gst, is_active, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
  `);

  const categories = ["Shirts", "Jeans", "T-Shirts", "Shoes", "Accessories", "Socks", "Jackets", "Sweaters"];
  const products = [];

  for (let i = 1; i <= 500; i++) {
    const category = categories[i % categories.length];
    const name = `${category.slice(0, -1)} Model ${String(i).padStart(3, "0")}`;
    const sku = `${category.toUpperCase().slice(0, 3)}-${String(i).padStart(4, "0")}`;
    const barcode = `8901234${String(i).padStart(6, "0")}`;
    const purchase = Math.floor(Math.random() * 800) + 150; // ₹150 - ₹950
    const margin = Math.floor(Math.random() * 500) + 100; // ₹100 - ₹600 markup
    const selling = purchase + margin;
    const stock = Math.floor(Math.random() * 150) + 10; // 10 to 160 units
    const minStock = Math.floor(Math.random() * 15) + 5; // 5 to 20 units
    const gst = [5, 12, 18][i % 3];

    const result = insertProduct.run(name, sku, barcode, category, purchase * 100, selling * 100, stock, minStock, gst);
    products.push({
      id: result.lastInsertRowid,
      selling_price: selling * 100,
      gst
    });
  }

  // 2. Seed 1000 Customers
  console.log("👥 Generating 1000 customers...");
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, email, address, notes, total_orders, lifetime_value, last_visit)
    VALUES (?, ?, ?, ?, NULL, 0, 0, NULL)
  `);

  const firstNames = ["Amit", "Rahul", "Priya", "Neha", "Sunita", "Vijay", "Anil", "Deepa", "Vikram", "Sanjay", "Karan", "Rohan", "Sneha", "Aditi", "Manish", "Rajesh", "Kavita", "Harish", "Arjun", "Divya"];
  const lastNames = ["Sharma", "Verma", "Singh", "Nair", "Patel", "Gupta", "Malhotra", "Das", "Joshi", "Mehra", "Kumar", "Rao", "Reddy", "Choudhury", "Bose", "Sen", "Menon", "Yadav", "Mishra", "Shah"];
  const cities = ["Mumbai", "Delhi", "Bengaluru", "Kolkata", "Chennai", "Hyderabad", "Pune", "Ahmedabad", "Jaipur", "Lucknow"];
  const customerIds = [];

  for (let i = 1; i <= 1000; i++) {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${fn} ${ln}`;
    const phone = String(9000000000 + i);
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`;
    const address = cities[i % cities.length];

    const result = insertCustomer.run(name, phone, email, address);
    customerIds.push(result.lastInsertRowid);
  }

  // 3. Seed 10000 Sales
  console.log("💰 Generating 10,000 sales transactions...");
  const insertSale = db.prepare(`
    INSERT INTO sales (invoice_number, customer_id, cashier_name, payment_method, subtotal, discount, gst, grand_total, public_token, pdf_url, shared_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, quantity, selling_price, discount, line_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const updateProductStock = db.prepare(`
    UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?
  `);

  const updateCustomerStats = db.prepare(`
    UPDATE customers
    SET total_orders = total_orders + 1,
        lifetime_value = lifetime_value + ?,
        last_visit = ?
    WHERE id = ?
  `);

  const paymentMethods = ["Cash", "UPI", "Card", "Wallet"];
  const cashiers = ["Rohan (Admin)", "Karan (Manager)", "Sneha (Cashier)"];
  
  // Date spread (past 30 days)
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (let i = 1; i <= 10000; i++) {
    const invoiceNumber = `INV-2026-${String(i).padStart(6, "0")}`;
    const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
    const cashier = cashiers[Math.floor(Math.random() * cashiers.length)];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const token = crypto.randomBytes(9).toString("base64url").substring(0, 12);
    
    // Choose transaction date
    const ageMs = Math.floor(Math.random() * thirtyDaysMs);
    const saleDateStr = new Date(nowMs - ageMs).toISOString().replace("T", " ").substring(0, 19);

    // Add 1 to 3 items
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let subtotal = 0;
    let totalGst = 0;

    for (let k = 0; k < itemCount; k++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      // Prevent duplicates in same invoice
      if (items.some(it => it.id === prod.id)) continue;
      
      const qty = Math.floor(Math.random() * 3) + 1;
      const lineSub = prod.selling_price * qty;
      const lineGst = Math.floor(lineSub * (prod.gst / 100));
      
      items.push({
        id: prod.id,
        qty,
        selling_price: prod.selling_price,
        line_total: lineSub + lineGst
      });

      subtotal += lineSub;
      totalGst += lineGst;
    }

    const discountPercent = Math.random() < 0.2 ? [5, 10, 15][Math.floor(Math.random() * 3)] : 0;
    const discount = Math.floor((subtotal * discountPercent) / 100);
    const grandTotal = subtotal - discount + totalGst;

    const saleResult = insertSale.run(
      invoiceNumber,
      customerId,
      cashier,
      paymentMethod,
      subtotal,
      discount,
      totalGst,
      grandTotal,
      token,
      saleDateStr
    );

    const saleId = saleResult.lastInsertRowid;

    for (const item of items) {
      insertSaleItem.run(
        saleId,
        item.id,
        item.qty,
        item.selling_price,
        0, // line item discount
        item.line_total
      );
      updateProductStock.run(item.qty, item.id);
    }

    updateCustomerStats.run(grandTotal, saleDateStr, customerId);
  }
});

try {
  run();
  console.log("✅ Seeding stress test data completed successfully!");
} catch (e) {
  console.error("❌ Seeding failed:", e);
} finally {
  db.close();
}
