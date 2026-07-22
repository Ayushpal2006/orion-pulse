import { create } from "zustand";
import { type Product, type Customer } from "./mock-data";

export type Role = "Admin" | "Manager" | "Cashier";
export type Payment = "Cash" | "UPI" | "Card" | "Wallet";
export type Theme = "light" | "dark" | "system";
export type PaperWidth = "58mm" | "80mm" | "A4";

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  gst: number;
  qty: number;
  discount: number; // percent
  emoji: string;
};

export type ParkedSale = {
  id: string;
  label: string;
  cart: CartLine[];
  customerMobile: string;
  customerName: string;
  payment: Payment;
  savedAt: string;
};

export type StockAdjustReason = "Purchase" | "Damage" | "Return" | "Manual";

type State = {
  role: Role;
  paletteOpen: boolean;
  cart: CartLine[];
  payment: Payment;
  customerMobile: string;
  customerName: string;
  products: Product[];
  customers: Customer[];
  parkedSales: ParkedSale[];
  shopName: string;
  gstin: string;
  printer: "Internal POS" | "Bluetooth" | "USB";
  theme: Theme;
  // extended settings
  logo?: string;
  currency: string;
  taxRate: number;
  receiptHeader: string;
  receiptFooter: string;
  upiId: string;
  qrPosition: "Top" | "Bottom";
  paperWidth: PaperWidth;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  whatsappFooter: string;
  requireCustomerBeforeCheckout: boolean;
  receiptTemplate: "Classic" | "Retail" | "Premium" | "Compact";
};

type Actions = {
  setRole: (r: Role) => void;
  setPaletteOpen: (v: boolean) => void;
  addToCart: (p: Product) => void;
  incQty: (id: string) => void;
  decQty: (id: string) => void;
  removeLine: (id: string) => void;
  setLineDiscount: (id: string, d: number) => void;
  clearCart: () => void;
  setPayment: (p: Payment) => void;
  setCustomerMobile: (m: string) => void;
  setCustomerName: (n: string) => void;

  // products
  setProducts: (products: Product[]) => void;
  addProduct: (p: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  duplicateProduct: (id: string) => void;
  adjustStock: (id: string, delta: number, reason: StockAdjustReason) => void;

  // customers
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (c: Customer) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // parked sales
  parkSale: () => void;
  resumeSale: (id: string) => void;
  deleteParkedSale: (id: string) => void;

  // settings
  setShopName: (s: string) => void;
  setGstin: (s: string) => void;
  setPrinter: (p: State["printer"]) => void;
  setTheme: (t: Theme) => void;
  setLogo: (l: string | undefined) => void;
  setCurrency: (c: string) => void;
  setTaxRate: (n: number) => void;
  setReceiptHeader: (s: string) => void;
  setReceiptFooter: (s: string) => void;
  setUpiId: (s: string) => void;
  setQrPosition: (p: "Top" | "Bottom") => void;
  setPaperWidth: (p: PaperWidth) => void;
  setStoreAddress: (s: string) => void;
  setStorePhone: (s: string) => void;
  setStoreEmail: (s: string) => void;
  setWhatsappFooter: (s: string) => void;
  setRequireCustomerBeforeCheckout: (v: boolean) => void;
  setReceiptTemplate: (t: "Classic" | "Retail" | "Premium" | "Compact") => void;
};

export const useApp = create<State & Actions>((set, get) => ({
  role: "Admin",
  paletteOpen: false,
  cart: [],
  payment: "UPI",
  customerMobile: "",
  customerName: "",
  products: [],
  customers: [],
  parkedSales: [],
  shopName: "Apka Bill Store",
  gstin: "27ABCDE1234F1Z5",
  printer: "Internal POS",
  theme: "system",
  logo: undefined,
  currency: "INR",
  taxRate: 12,
  receiptHeader: "Thank you for shopping with us",
  receiptFooter: "*** Thank you — visit again ***",
  upiId: "apkabill@upi",
  qrPosition: "Bottom",
  paperWidth: "80mm",
  storeAddress: "Shop 12, MG Road, Pune 411001",
  storePhone: "+91 98765 43210",
  storeEmail: "hello@apkabill.in",
  whatsappFooter: "Thank you for shopping. Visit Again.",
  requireCustomerBeforeCheckout: false,
  receiptTemplate: "Classic",

  setRole: (role) => set({ role }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  addToCart: (p) =>
    set((s) => {
      const existing = s.cart.find((l) => l.productId === p.id);
      if (existing) {
        return {
          cart: s.cart.map((l) =>
            l.productId === p.id ? { ...l, qty: l.qty + 1 } : l,
          ),
        };
      }
      return {
        cart: [
          ...s.cart,
          { productId: p.id, name: p.name, price: p.price, gst: p.gst, qty: 1, discount: 0, emoji: p.emoji },
        ],
      };
    }),
  incQty: (id) =>
    set((s) => ({ cart: s.cart.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l)) })),
  decQty: (id) =>
    set((s) => ({
      cart: s.cart.map((l) => (l.productId === id ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0),
    })),
  removeLine: (id) => set((s) => ({ cart: s.cart.filter((l) => l.productId !== id) })),
  setLineDiscount: (id, d) =>
    set((s) => ({
      cart: s.cart.map((l) => (l.productId === id ? { ...l, discount: Math.max(0, Math.min(100, d)) } : l)),
    })),
  clearCart: () => set({ cart: [], customerMobile: "", customerName: "" }),
  setPayment: (payment) => set({ payment }),
  setCustomerMobile: (customerMobile) => set({ customerMobile }),
  setCustomerName: (customerName) => set({ customerName }),

  setProducts: (products) => set({ products }),
  addProduct: (p) => set((s) => ({ products: [p, ...s.products] })),
  updateProduct: (id, patch) =>
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      ),
    })),
  deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
  duplicateProduct: (id) =>
    set((s) => {
      const src = s.products.find((p) => p.id === id);
      if (!src) return s;
      const newId = `p${Math.floor(Math.random() * 1000000)}`;
      const copy: Product = {
        ...src,
        id: newId,
        name: `${src.name} (Copy)`,
        sku: `${src.sku}-COPY`,
        barcode: String(8900000000000 + Math.floor(Math.random() * 999999)),
        stock: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { products: [copy, ...s.products] };
    }),
  adjustStock: (id, delta) =>
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id
          ? { ...p, stock: Math.max(0, p.stock + delta), updatedAt: new Date().toISOString() }
          : p,
      ),
    })),

  setCustomers: (customers) => set({ customers }),
  addCustomer: (c) => set((s) => {
    const exists = s.customers.some((x) => x.mobile === c.mobile);
    if (exists) {
      return {
        customers: s.customers.map((x) => x.mobile === c.mobile ? { ...x, ...c } : x)
      };
    }
    return { customers: [c, ...s.customers] };
  }),
  updateCustomer: (id, patch) =>
    set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),

  parkSale: () => {
    const { cart, customerMobile, customerName, payment } = get();
    if (cart.length === 0) return;
    const label = customerName || (customerMobile ? `+91 ${customerMobile}` : `Sale ${new Date().toLocaleTimeString()}`);
    const parked: ParkedSale = {
      id: `park-${Date.now()}`,
      label,
      cart,
      customerMobile,
      customerName,
      payment,
      savedAt: new Date().toISOString(),
    };
    set((s) => ({
      parkedSales: [parked, ...s.parkedSales],
      cart: [],
      customerMobile: "",
      customerName: "",
    }));
  },
  resumeSale: (id) =>
    set((s) => {
      const parked = s.parkedSales.find((p) => p.id === id);
      if (!parked) return s;
      return {
        cart: parked.cart,
        customerMobile: parked.customerMobile,
        customerName: parked.customerName,
        payment: parked.payment,
        parkedSales: s.parkedSales.filter((p) => p.id !== id),
      };
    }),
  deleteParkedSale: (id) => set((s) => ({ parkedSales: s.parkedSales.filter((p) => p.id !== id) })),

  setShopName: (shopName) => set({ shopName }),
  setGstin: (gstin) => set({ gstin }),
  setPrinter: (printer) => set({ printer }),
  setTheme: (theme) => set({ theme }),
  setLogo: (logo) => set({ logo }),
  setCurrency: (currency) => set({ currency }),
  setTaxRate: (taxRate) => set({ taxRate }),
  setReceiptHeader: (receiptHeader) => set({ receiptHeader }),
  setReceiptFooter: (receiptFooter) => set({ receiptFooter }),
  setUpiId: (upiId) => set({ upiId }),
  setQrPosition: (qrPosition) => set({ qrPosition }),
  setPaperWidth: (paperWidth) => set({ paperWidth }),
  setStoreAddress: (storeAddress) => set({ storeAddress }),
  setStorePhone: (storePhone) => set({ storePhone }),
  setStoreEmail: (storeEmail) => set({ storeEmail }),
  setWhatsappFooter: (whatsappFooter) => set({ whatsappFooter }),
  setRequireCustomerBeforeCheckout: (requireCustomerBeforeCheckout) => set({ requireCustomerBeforeCheckout }),
  setReceiptTemplate: (receiptTemplate) => set({ receiptTemplate }),
}));

export const cartTotals = (cart: CartLine[]) => {
  let subtotal = 0;
  let discount = 0;
  let gst = 0;
  for (const l of cart) {
    const line = l.price * l.qty;
    const disc = (line * l.discount) / 100;
    const taxable = line - disc;
    const tax = (taxable * l.gst) / 100;
    subtotal += line;
    discount += disc;
    gst += tax;
  }
  return { subtotal, discount, gst, total: subtotal - discount + gst };
};
