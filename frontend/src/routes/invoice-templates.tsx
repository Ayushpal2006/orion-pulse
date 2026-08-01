import { createFileRoute } from "@tanstack/react-router";
import { InvoiceTemplatesPage } from "@/components/invoice-templates-page";
import { RoleGate } from "@/components/role-gate";

export const Route = createFileRoute("/invoice-templates")({
  head: () => ({
    meta: [
      { title: "Invoice Templates · Apka Bill" },
      { name: "description", content: "Customize invoice templates, header notices, footers, logo, and preview live receipt designs." },
    ],
  }),
  component: InvoiceTemplatesRouteComponent,
});

function InvoiceTemplatesRouteComponent() {
  return (
    <RoleGate allow={["Super Admin", "Admin", "Manager"]}>
      <InvoiceTemplatesPage />
    </RoleGate>
  );
}
