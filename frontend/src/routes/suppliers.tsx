import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers · Apka Bill" },
      { name: "description", content: "Supplier CRM directory and stock procurement records." },
    ],
  }),
});
