import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses Management · Apka Bill" },
      { name: "description", content: "Track store operational expenses, rent, salaries, utilities, and maintain financial records." },
    ],
  }),
});
