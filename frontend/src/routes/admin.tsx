import { createFileRoute } from "@tanstack/react-router";
import { SuperAdminPage } from "./super-admin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Panel · Apka Bill" },
      { name: "description", content: "Internal SaaS Platform Administration and Customer Tenant Control." },
    ],
  }),
  component: SuperAdminPage,
});
