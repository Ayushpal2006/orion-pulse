import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Apka Bill" },
      { name: "description", content: "Daily & monthly sales, profit analysis and GST-ready reports — export to PDF or Excel." },
      { property: "og:title", content: "Reports · Apka Bill" },
      { property: "og:description", content: "Instant, offline reporting for growing retail." },
    ],
  }),
});
