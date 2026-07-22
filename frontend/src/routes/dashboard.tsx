import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "./index";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Apka Bill" },
      { name: "description", content: "Real-time retail store analytics, sales overview, inventory alerts, and key performance metrics." },
    ],
  }),
  component: Dashboard,
});
