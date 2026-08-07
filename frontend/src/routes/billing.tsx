import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing · Apka Bill" },
      { name: "description", content: "Sub-12s checkout — scan, add, take payment, print, and queue WhatsApp receipts." },
      { property: "og:title", content: "Billing · Apka Bill" },
      { property: "og:description", content: "Blazing-fast, offline-first point-of-sale checkout." },
    ],
  }),
});
