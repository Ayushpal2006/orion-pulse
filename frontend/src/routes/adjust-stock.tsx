import { createFileRoute } from "@tanstack/react-router";
import { StockAdjustmentsPage } from "./stock-adjustments";

export const Route = createFileRoute("/adjust-stock")({
  head: () => ({
    meta: [
      { title: "Adjust Stock · Apka Bill" },
      { name: "description", content: "Record inventory corrections, physical counts, damages, lost items, and opening stock." },
    ],
  }),
  component: StockAdjustmentsPage,
});
