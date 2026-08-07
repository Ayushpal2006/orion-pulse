import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory · Apka Bill" },
      { name: "description", content: "Track stock, SKUs, GST slabs and reorder thresholds — with instant barcode generation." },
      { property: "og:title", content: "Inventory · Apka Bill" },
      { property: "og:description", content: "Stock, SKUs and barcodes in one place." },
    ],
  }),
});
