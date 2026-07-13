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

export const products: Product[] = [];
export const customers: Customer[] = [];
export const invoices: Invoice[] = [];
export const insights = [] as const;
export const salesSeries = {
  Today: [],
  Yesterday: [],
  Week: [],
  Last7: [],
  Last30: [],
  Month: [],
  LastMonth: [],
  Year: [],
};
