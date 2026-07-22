import { createFileRoute } from "@tanstack/react-router";
import { Inventory } from "./inventory";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Products & Inventory · Apka Bill" },
      { name: "description", content: "Manage store products, stock counts, SKUs, GST rates, and price levels." },
    ],
  }),
  component: Inventory,
});
