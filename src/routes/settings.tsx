import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RoleGate } from "@/components/role-gate";
import { useApp, type Role } from "@/lib/store";
import { toast } from "sonner";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Orion POS" },
      { name: "description", content: "Configure your shop, GSTIN, printer and user roles." },
      { property: "og:title", content: "Settings · Orion POS" },
      { property: "og:description", content: "Business, printer and role setup." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <RoleGate allow={["Admin", "Manager"]}>
      <Settings />
    </RoleGate>
  );
}

function Settings() {
  const shopName = useApp((s) => s.shopName);
  const setShopName = useApp((s) => s.setShopName);
  const gstin = useApp((s) => s.gstin);
  const setGstin = useApp((s) => s.setGstin);
  const printer = useApp((s) => s.printer);
  const setPrinter = useApp((s) => s.setPrinter);
  const role = useApp((s) => s.role);
  const setRole = useApp((s) => s.setRole);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Store, hardware and access control.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-soft p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Business</div>
            <div className="text-xs text-muted-foreground">Shown on invoices and receipts</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Shop name</Label>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">GSTIN</Label>
            <Input value={gstin} onChange={(e) => setGstin(e.target.value)} className="h-11 rounded-xl tabular" />
          </div>
        </div>

        <div className="card-soft p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Printer</div>
            <div className="text-xs text-muted-foreground">Thermal slip destination</div>
          </div>
          <Select value={printer} onValueChange={(v) => setPrinter(v as typeof printer)}>
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Internal POS">Internal POS</SelectItem>
              <SelectItem value="Bluetooth">Bluetooth</SelectItem>
              <SelectItem value="USB">USB</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl"
            onClick={() =>
              toast.success(`Test print sent`, {
                description: `Routed to ${printer} printer.`,
              })
            }
          >
            <Printer className="mr-2 size-4" /> Test print
          </Button>
        </div>

        <div className="card-soft p-5 space-y-4 md:col-span-2">
          <div>
            <div className="text-sm font-semibold">Active role</div>
            <div className="text-xs text-muted-foreground">
              Switch roles to preview the permission matrix.
            </div>
          </div>
          <RadioGroup
            value={role}
            onValueChange={(v) => setRole(v as Role)}
            className="grid gap-3 sm:grid-cols-3"
          >
            {(["Admin", "Manager", "Cashier"] as const).map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-muted/40 has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-muted/50"
              >
                <RadioGroupItem value={r} className="mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">{r}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r === "Admin" && "Full access: billing, inventory, reports, settings."}
                    {r === "Manager" && "Everything except account deletion & GSTIN edits."}
                    {r === "Cashier" && "Billing + basic inventory only. No settings, no profit reports."}
                  </div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
