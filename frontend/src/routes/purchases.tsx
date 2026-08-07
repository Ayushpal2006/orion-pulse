import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/purchases")({
  head: () => ({
    meta: [
      { title: "Purchases · Orion POS" },
      { name: "description", content: "Procure inventory, register vendor invoices, and manage purchase history." },
    ],
  }),
});
