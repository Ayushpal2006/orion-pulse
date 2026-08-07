import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profit")({
  head: () => ({
    meta: [
      { title: "Profit & Margin · Apka Bill" },
      { name: "description", content: "Real-time gross profit, margin analysis, and product-level P&L using average cost method." },
    ],
  }),
});
