import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Apka Bill" },
      { name: "description", content: "Store configuration, billing & printer setup for Apka Bill." },
      { property: "og:title", content: "Settings · Apka Bill" },
    ],
  }),
});
