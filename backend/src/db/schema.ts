import { pgTable, serial, text, integer, timestamp, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  gst_number: text("gst_number"),
  logo_url: text("logo_url"),
  currency: text("currency").default("INR").notNull(),
  timezone: text("timezone").default("Asia/Kolkata").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  phone: text("phone"),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull(), // Admin, Manager, Cashier
  store_id: integer("store_id").references(() => stores.id).notNull(),
  is_active: integer("is_active").default(1).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    store_id: integer("store_id").references(() => stores.id).notNull(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    category: text("category"),
    purchase_price: integer("purchase_price").notNull(),
    selling_price: integer("selling_price").notNull(),
    stock: integer("stock").default(0).notNull(),
    minimum_stock: integer("minimum_stock").default(0).notNull(),
    gst: integer("gst").default(18).notNull(),
    is_active: integer("is_active").default(1).notNull(),
    image_url: text("image_url"),
    margin_percent: integer("margin_percent").default(0).notNull(),
    markup_percent: integer("markup_percent").default(0).notNull(),
    average_cost: integer("average_cost").default(0).notNull(),
    last_purchase_cost: integer("last_purchase_cost").default(0).notNull(),
    max_stock: integer("max_stock").default(0).notNull(),
    reorder_quantity: integer("reorder_quantity").default(0).notNull(),
    preferred_supplier_id: integer("preferred_supplier_id"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    skuIdx: index("idx_products_sku").on(table.store_id, table.sku),
    barcodeIdx: index("idx_products_barcode").on(table.store_id, table.barcode),
    nameIdx: index("idx_products_name").on(table.name),
    categoryIdx: index("idx_products_category").on(table.category),
  })
);

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    store_id: integer("store_id").references(() => stores.id).notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    total_orders: integer("total_orders").default(0).notNull(),
    lifetime_value: integer("lifetime_value").default(0).notNull(),
    last_visit: timestamp("last_visit"),
    is_active: integer("is_active").default(1).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    phoneIdx: index("idx_customers_phone").on(table.store_id, table.phone),
    nameIdx: index("idx_customers_name").on(table.name),
  })
);

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    store_id: integer("store_id").references(() => stores.id).notNull(),
    invoice_number: text("invoice_number").notNull(),
    customer_id: integer("customer_id").references(() => customers.id),
    cashier_name: text("cashier_name"),
    payment_method: text("payment_method").notNull(), // Split, Cash, UPI, Card, Wallet, etc.
    payment_details: text("payment_details"), // JSON split breakdown
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").default(0).notNull(),
    gst: integer("gst").default(0).notNull(),
    grand_total: integer("grand_total").notNull(),
    paid_amount: integer("paid_amount").default(0).notNull(),
    balance: integer("balance").default(0).notNull(),
    public_token: text("public_token"),
    pdf_url: text("pdf_url"),
    shared_at: timestamp("shared_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    status: text("status").default("COMPLETED").notNull(),
    void_reason: text("void_reason"),
    voided_by: text("voided_by"),
    voided_at: timestamp("voided_at"),
  },
  (table) => ({
    invoiceIdx: index("idx_sales_invoice_number").on(table.store_id, table.invoice_number),
    publicTokenIdx: uniqueIndex("idx_sales_public_token").on(table.public_token),
    createdIdx: index("idx_sales_created_at").on(table.created_at),
    customerIdx: index("idx_sales_customer_id").on(table.customer_id),
  })
);

export const sale_items = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    sale_id: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    product_id: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    selling_price: integer("selling_price").notNull(),
    discount: integer("discount").default(0).notNull(),
    line_total: integer("line_total").notNull(),
  },
  (table) => ({
    saleIdx: index("idx_sale_items_sale_id").on(table.sale_id),
    productIdx: index("idx_sale_items_product_id").on(table.product_id),
  })
);

export const returns = pgTable(
  "returns",
  {
    id: serial("id").primaryKey(),
    store_id: integer("store_id").references(() => stores.id).notNull(),
    original_sale_id: integer("original_sale_id").references(() => sales.id).notNull(),
    return_invoice_number: text("return_invoice_number").notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").default(0).notNull(),
    gst: integer("gst").default(0).notNull(),
    grand_total: integer("grand_total").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    returnInvoiceIdx: index("idx_returns_invoice_number").on(table.store_id, table.return_invoice_number),
  })
);

export const return_items = pgTable(
  "return_items",
  {
    id: serial("id").primaryKey(),
    return_id: integer("return_id").references(() => returns.id, { onDelete: "cascade" }).notNull(),
    product_id: integer("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").notNull(),
    selling_price: integer("selling_price").notNull(),
    refund_amount: integer("refund_amount").notNull(),
  }
);

export const inventory_logs = pgTable(
  "inventory_logs",
  {
    id: serial("id").primaryKey(),
    product_id: integer("product_id").references(() => products.id).notNull(),
    store_id: integer("store_id").references(() => stores.id).notNull(),
    type: text("type").notNull(), // SALE, RETURN, PURCHASE, ADJUSTMENT
    quantity: integer("quantity").notNull(),
    before_stock: integer("before_stock").notNull(),
    after_stock: integer("after_stock").notNull(),
    reference: text("reference"), // invoice_number or return_invoice_number
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index("idx_inv_logs_product").on(table.product_id),
    storeIdx: index("idx_inv_logs_store").on(table.store_id),
  })
);

export const sync_jobs = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  job_type: text("job_type").notNull(),
  payload: text("payload").notNull(),
  status: text("status").default("pending").notNull(),
  retry_count: integer("retry_count").default(0).notNull(),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  last_attempt: timestamp("last_attempt"),
});

export const settings = pgTable(
  "settings",
  {
    store_id: integer("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.store_id, table.key] }),
  })
);

// Supplier ERP (Phase 5)
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  supplier_code: text("supplier_code").unique().notNull(),
  company_name: text("company_name").notNull(),
  contact_person: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  gst_number: text("gst_number"),
  pan_number: text("pan_number"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  postal_code: text("postal_code"),
  opening_balance: integer("opening_balance").default(0).notNull(),
  current_balance: integer("current_balance").default(0).notNull(),
  payment_terms: text("payment_terms"),
  credit_limit: integer("credit_limit").default(0).notNull(),
  is_active: integer("is_active").default(1).notNull(),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const purchase_orders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  supplier_id: integer("supplier_id").references(() => suppliers.id).notNull(),
  po_number: text("po_number").unique().notNull(),
  status: text("status").notNull(), // Draft, Pending, Approved, Ordered, Partially Received, Received, Cancelled
  expected_delivery: timestamp("expected_delivery"),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").default(0).notNull(),
  gst: integer("gst").default(0).notNull(),
  grand_total: integer("grand_total").notNull(),
  invoice_number: text("invoice_number"),
  invoice_date: timestamp("invoice_date"),
  transport_charges: integer("transport_charges").default(0).notNull(),
  other_charges: integer("other_charges").default(0).notNull(),
  net_amount: integer("net_amount").notNull(),
  payment_status: text("payment_status").notNull(), // Unpaid, Partially Paid, Paid
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const purchase_items = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  purchase_order_id: integer("purchase_order_id").references(() => purchase_orders.id, { onDelete: "cascade" }).notNull(),
  product_id: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  received_quantity: integer("received_quantity").default(0).notNull(),
  purchase_price: integer("purchase_price").notNull(),
  discount: integer("discount").default(0).notNull(),
  gst: integer("gst").default(0).notNull(),
  line_total: integer("line_total").notNull(),
});

export const supplier_payments = pgTable("supplier_payments", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  supplier_id: integer("supplier_id").references(() => suppliers.id).notNull(),
  amount: integer("amount").notNull(),
  payment_method: text("payment_method").notNull(), // Cash, UPI, Bank, Cheque, Credit
  reference_number: text("reference_number"),
  payment_date: timestamp("payment_date").defaultNow().notNull(),
  notes: text("notes"),
});

export const supplier_ledger = pgTable("supplier_ledger", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  supplier_id: integer("supplier_id").references(() => suppliers.id).notNull(),
  transaction_type: text("transaction_type").notNull(), // PURCHASE, PAYMENT, RETURN, ADJUSTMENT
  amount: integer("amount").notNull(), // positive = credit (owed), negative = debit (paid/returned)
  balance: integer("balance").notNull(),
  reference: text("reference"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const inventory_adjustments = pgTable("inventory_adjustments", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  product_id: integer("product_id").references(() => products.id).notNull(),
  type: text("type").notNull(), // ADD, REMOVE
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(), // Damage, Expired, Lost, Correction, Opening Stock, Audit
  before_stock: integer("before_stock").notNull(),
  after_stock: integer("after_stock").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Expenses Module (Phase 6)
export const expense_categories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  category_id: integer("category_id").references(() => expense_categories.id).notNull(),
  amount: integer("amount").notNull(),
  payment_method: text("payment_method").notNull(), // Cash, UPI, Card, Bank, etc.
  vendor: text("vendor"),
  description: text("description"),
  date: timestamp("date").defaultNow().notNull(),
  receipt_image_url: text("receipt_image_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Offline-First Sync & Hardware profiles (Phase 7)
export const device_settings = pgTable("device_settings", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  device_id: text("device_id").unique().notNull(),
  printer_profile: text("printer_profile"), // JSON config
  scanner_profile: text("scanner_profile"), // JSON config
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const backup_history = pgTable("backup_history", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  filename: text("filename").notNull(),
  file_size: integer("file_size").notNull(),
  backup_type: text("backup_type").notNull(), // SQLITE, POSTGRES
  status: text("status").notNull(), // pending, completed, failed
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const audit_logs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  user_id: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // LOGIN, SALE, RETURN, INVENTORY_CHANGE, SYNC_EVENT, SETTINGS_CHANGE, BACKUP
  details: text("details"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const sync_history = pgTable("sync_history", {
  id: serial("id").primaryKey(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  started_at: timestamp("started_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
  status: text("status").notNull(), // pending, completed, failed
  records_synced: integer("records_synced").default(0).notNull(),
  error_message: text("error_message"),
});

// SaaS Multi-Tenancy Expansion (Phases 6 & 8)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  billing_plan: text("billing_plan").default("Basic").notNull(), // Basic, Professional, Enterprise
  subscription_status: text("subscription_status").default("active").notNull(),
  razorpay_subscription_id: text("razorpay_subscription_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const organization_invitations = pgTable("organization_invitations", {
  id: serial("id").primaryKey(),
  organization_id: integer("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  role: text("role").default("Manager").notNull(), // Manager, Cashier
  token: text("token").unique().notNull(),
  status: text("status").default("pending").notNull(), // pending, accepted, expired
  created_at: timestamp("created_at").defaultNow().notNull(),
  expires_at: timestamp("expires_at").notNull(),
});

export const api_keys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  organization_id: integer("organization_id").references(() => organizations.id).notNull(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  name: text("name").notNull(),
  key_hash: text("key_hash").notNull(),
  prefix: text("prefix").notNull(),
  scopes: text("scopes"), // e.g. "read:sales,write:products"
  is_active: integer("is_active").default(1).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  expires_at: timestamp("expires_at"),
});

export const support_tickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  organization_id: integer("organization_id").references(() => organizations.id).notNull(),
  store_id: integer("store_id").references(() => stores.id).notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").default("Open").notNull(), // Open, In Progress, Resolved, Closed
  priority: text("priority").default("Medium").notNull(), // Low, Medium, High, Urgent
  created_at: timestamp("created_at").defaultNow().notNull(),
});
