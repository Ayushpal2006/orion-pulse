import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings V2 · Orion POS" },
      { name: "description", content: "Enterprise configuration center for Orion POS." },
      { property: "og:title", content: "Settings V2 · Orion POS" },
    ],
  }),
});
