export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  purchase: number;
  price: number;
  gst: number;
  stock: number;
  reorder: number;
  emoji: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  name: string;
  mobile: string;
  ltv: number;
  visits: number;
  lastVisit: string;
  since: string;
  email?: string;
  address?: string;
  notes?: string;
};

export type InvoiceLine = {
  productId: string;
  name: string;
  qty: number;
  price: number;
};

export type Invoice = {
  id: string;
  date: string;
  customerId: string;
  total: number;
  payment: "Cash" | "UPI" | "Card" | "Wallet";
  lines: InvoiceLine[];
};

const now = new Date().toISOString();

export const products: Product[] = [
  { id: "p1", name: "Blue Denim Jeans", sku: "APR-BJN-32", barcode: "8901234500011", category: "Jeans", purchase: 620, price: 1299, gst: 12, stock: 42, reorder: 10, emoji: "👖", createdAt: now, updatedAt: now },
  { id: "p2", name: "Cotton Crew Tee", sku: "APR-CCT-M", barcode: "8901234500028", category: "T-Shirts", purchase: 180, price: 499, gst: 12, stock: 8, reorder: 12, emoji: "👕", createdAt: now, updatedAt: now },
  { id: "p3", name: "Leather Belt", sku: "ACC-LBT-BR", barcode: "8901234500035", category: "Accessories", purchase: 260, price: 799, gst: 18, stock: 0, reorder: 6, emoji: "🧣", createdAt: now, updatedAt: now },
  { id: "p4", name: "Sneakers Runner", sku: "FTW-SNR-9", barcode: "8901234500042", category: "Shoes", purchase: 1450, price: 2999, gst: 18, stock: 22, reorder: 5, emoji: "👟", createdAt: now, updatedAt: now },
  { id: "p5", name: "Wool Beanie", sku: "ACC-WBN-GY", barcode: "8901234500059", category: "Accessories", purchase: 120, price: 349, gst: 12, stock: 3, reorder: 10, emoji: "🧢", createdAt: now, updatedAt: now },
  { id: "p6", name: "Aviator Sunglasses", sku: "ACC-AVS-BK", barcode: "8901234500066", category: "Accessories", purchase: 380, price: 1199, gst: 18, stock: 17, reorder: 8, emoji: "🕶️", createdAt: now, updatedAt: now },
  { id: "p7", name: "Canvas Backpack", sku: "BAG-CVB-OL", barcode: "8901234500073", category: "Accessories", purchase: 640, price: 1599, gst: 18, stock: 11, reorder: 6, emoji: "🎒", createdAt: now, updatedAt: now },
  { id: "p8", name: "Analog Watch", sku: "WCH-ANL-SL", barcode: "8901234500080", category: "Accessories", purchase: 890, price: 2499, gst: 18, stock: 6, reorder: 4, emoji: "⌚", createdAt: now, updatedAt: now },
  { id: "p9", name: "Silk Scarf", sku: "ACC-SLS-RD", barcode: "8901234500097", category: "Accessories", purchase: 210, price: 699, gst: 12, stock: 14, reorder: 5, emoji: "🧣", createdAt: now, updatedAt: now },
  { id: "p10", name: "Cotton Socks 3-pk", sku: "APR-CSK-3", barcode: "8901234500103", category: "Accessories", purchase: 90, price: 249, gst: 5, stock: 58, reorder: 20, emoji: "🧦", createdAt: now, updatedAt: now },
  { id: "p11", name: "Formal Shirt", sku: "APR-FRS-40", barcode: "8901234500110", category: "Shirts", purchase: 520, price: 1499, gst: 12, stock: 19, reorder: 8, emoji: "👔", createdAt: now, updatedAt: now },
  { id: "p12", name: "Trouser Chinos", sku: "APR-TCH-34", barcode: "8901234500127", category: "Jeans", purchase: 580, price: 1699, gst: 12, stock: 2, reorder: 10, emoji: "🩳", createdAt: now, updatedAt: now },
];

export const customers: Customer[] = [
  { id: "c1", name: "Aarav Sharma", mobile: "9876543210", ltv: 24800, visits: 12, lastVisit: "2 days ago", since: "Jan 2024", email: "aarav@example.com", address: "12 MG Road, Pune", notes: "Prefers denim." },
  { id: "c2", name: "Priya Patel", mobile: "9123456780", ltv: 41200, visits: 21, lastVisit: "Yesterday", since: "Aug 2023", email: "priya@example.com", address: "44 Linking Road, Mumbai" },
  { id: "c3", name: "Rohan Mehta", mobile: "9988776655", ltv: 8600, visits: 4, lastVisit: "1 week ago", since: "Mar 2025" },
  { id: "c4", name: "Ishita Rao", mobile: "9765432109", ltv: 17300, visits: 9, lastVisit: "Today", since: "Nov 2024", email: "ishita@example.com" },
  { id: "c5", name: "Karan Singh", mobile: "9012345678", ltv: 62150, visits: 34, lastVisit: "3 days ago", since: "May 2022", notes: "VIP · Anniversary June 12." },
  { id: "c6", name: "Neha Iyer", mobile: "9345678901", ltv: 4200, visits: 2, lastVisit: "2 weeks ago", since: "Sep 2025" },
];

export const invoices: Invoice[] = [
  { id: "INV-10241", date: "Today, 11:24", customerId: "c4", total: 2098, payment: "UPI", lines: [{ productId: "p1", name: "Blue Denim Jeans", qty: 1, price: 1299 }, { productId: "p10", name: "Cotton Socks 3-pk", qty: 2, price: 249 }] },
  { id: "INV-10240", date: "Today, 10:02", customerId: "c2", total: 4298, payment: "Card", lines: [{ productId: "p4", name: "Sneakers Runner", qty: 1, price: 2999 }, { productId: "p11", name: "Formal Shirt", qty: 1, price: 1499 }] },
  { id: "INV-10239", date: "Yesterday", customerId: "c1", total: 799, payment: "Cash", lines: [{ productId: "p3", name: "Leather Belt", qty: 1, price: 799 }] },
  { id: "INV-10238", date: "Yesterday", customerId: "c5", total: 5697, payment: "UPI", lines: [{ productId: "p8", name: "Analog Watch", qty: 1, price: 2499 }, { productId: "p4", name: "Sneakers Runner", qty: 1, price: 2999 }] },
  { id: "INV-10237", date: "2 days ago", customerId: "c2", total: 1698, payment: "Wallet", lines: [{ productId: "p7", name: "Canvas Backpack", qty: 1, price: 1599 }] },
];

export const insights = [
  { tone: "growth", text: "Blue Denim Jeans generated ₹18,500 this week — up 32% vs last week." },
  { tone: "warn", text: "Restock Cotton Crew Tee within 3 days at current sell-through." },
  { tone: "info", text: "UPI now accounts for 61% of payments — Cash trending down." },
  { tone: "growth", text: "Repeat customers contributed 47% of today's revenue." },
] as const;

export const salesSeries = {
  Today: [
    { label: "9a", value: 1200 }, { label: "10a", value: 2100 }, { label: "11a", value: 3400 },
    { label: "12p", value: 2800 }, { label: "1p", value: 3900 }, { label: "2p", value: 4200 },
    { label: "3p", value: 3100 }, { label: "4p", value: 4700 }, { label: "5p", value: 5300 },
  ],
  Yesterday: [
    { label: "9a", value: 1000 }, { label: "10a", value: 1800 }, { label: "11a", value: 2900 },
    { label: "12p", value: 3300 }, { label: "1p", value: 3600 }, { label: "2p", value: 3800 },
    { label: "3p", value: 3400 }, { label: "4p", value: 4100 }, { label: "5p", value: 4500 },
  ],
  Week: [
    { label: "Mon", value: 18200 }, { label: "Tue", value: 21400 }, { label: "Wed", value: 17900 },
    { label: "Thu", value: 24800 }, { label: "Fri", value: 31200 }, { label: "Sat", value: 42100 },
    { label: "Sun", value: 28600 },
  ],
  Last7: Array.from({ length: 7 }, (_, i) => ({ label: `D${i + 1}`, value: 15000 + Math.round(Math.sin(i) * 6000 + i * 1200) })),
  Last30: Array.from({ length: 30 }, (_, i) => ({ label: `${i + 1}`, value: 11000 + Math.round(Math.cos(i / 2) * 5000 + i * 300) })),
  Month: Array.from({ length: 30 }, (_, i) => ({ label: `${i + 1}`, value: 12000 + Math.round(Math.sin(i / 3) * 6000 + i * 400) })),
  LastMonth: Array.from({ length: 30 }, (_, i) => ({ label: `${i + 1}`, value: 10500 + Math.round(Math.sin(i / 4) * 5500 + i * 250) })),
  Year: [
    { label: "Jan", value: 412000 }, { label: "Feb", value: 386000 }, { label: "Mar", value: 441000 },
    { label: "Apr", value: 402000 }, { label: "May", value: 468000 }, { label: "Jun", value: 512000 },
    { label: "Jul", value: 489000 }, { label: "Aug", value: 534000 }, { label: "Sep", value: 561000 },
    { label: "Oct", value: 598000 }, { label: "Nov", value: 621000 }, { label: "Dec", value: 674000 },
  ],
};
