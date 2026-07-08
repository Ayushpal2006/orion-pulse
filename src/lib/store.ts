import { create } from "zustand";
import { products as seedProducts, type Product } from "./mock-data";

export type Role = "Admin" | "Manager" | "Cashier";
export type Payment = "Cash" | "UPI" | "Card" | "Wallet";

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  gst: number;
  qty: number;
  discount: number; // percent
  emoji: string;
};

type State = {
  role: Role;
  paletteOpen: boolean;
  cart: CartLine[];
  payment: Payment;
  customerMobile: string;
  customerName: string;
  products: Product[];
  shopName: string;
  gstin: string;
  printer: "Internal POS" | "Bluetooth" | "USB";
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
  addProduct: (p: Product) => void;
  setShopName: (s: string) => void;
  setGstin: (s: string) => void;
  setPrinter: (p: State["printer"]) => void;
};

export const useApp = create<State & Actions>((set) => ({
  role: "Admin",
  paletteOpen: false,
  cart: [],
  payment: "UPI",
  customerMobile: "",
  customerName: "",
  products: seedProducts,
  shopName: "Orion Threads & Co.",
  gstin: "27ABCDE1234F1Z5",
  printer: "Internal POS",

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
          {
            productId: p.id,
            name: p.name,
            price: p.price,
            gst: p.gst,
            qty: 1,
            discount: 0,
            emoji: p.emoji,
          },
        ],
      };
    }),
  incQty: (id) =>
    set((s) => ({
      cart: s.cart.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l)),
    })),
  decQty: (id) =>
    set((s) => ({
      cart: s.cart
        .map((l) => (l.productId === id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    })),
  removeLine: (id) => set((s) => ({ cart: s.cart.filter((l) => l.productId !== id) })),
  setLineDiscount: (id, d) =>
    set((s) => ({
      cart: s.cart.map((l) =>
        l.productId === id ? { ...l, discount: Math.max(0, Math.min(100, d)) } : l,
      ),
    })),
  clearCart: () => set({ cart: [], customerMobile: "", customerName: "" }),
  setPayment: (payment) => set({ payment }),
  setCustomerMobile: (customerMobile) => set({ customerMobile }),
  setCustomerName: (customerName) => set({ customerName }),
  addProduct: (p) => set((s) => ({ products: [p, ...s.products] })),
  setShopName: (shopName) => set({ shopName }),
  setGstin: (gstin) => set({ gstin }),
  setPrinter: (printer) => set({ printer }),
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
  return {
    subtotal,
    discount,
    gst,
    total: subtotal - discount + gst,
  };
};
