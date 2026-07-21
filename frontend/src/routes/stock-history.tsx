import { createFileRoute } from "@tanstack/react-router";
import { StockHistoryPage } from "./inventory.history";

export const Route = createFileRoute("/stock-history")({
  head: () => ({
    meta: [
      { title: "Stock History · Orion POS" },
      { name: "description", content: "Complete audit log and historical record of all inventory stock movements." },
    ],
  }),
  component: StockHistoryPage,
});
