import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RoleGate } from "@/components/role-gate";
import { useApp, type Role, type PaperWidth } from "@/lib/store";
import { toast } from "sonner";
import { Printer, Upload, Download, RotateCcw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReceiptPreview } from "@/components/receipt-preview";

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
  const s = useApp();

  const uploadLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => s.setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Store, hardware, receipts and access control.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Business */}
        <div className="card-soft space-y-4 p-5">
          <div>
            <div className="text-sm font-semibold">Business</div>
            <div className="text-xs text-muted-foreground">Shown on invoices and receipts</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid size-14 place-items-center overflow-hidden rounded-xl bg-muted text-2xl">
              {s.logo ? <img src={s.logo} alt="" className="size-full object-cover" /> : "🏬"}
            </div>
            <div className="flex-1">
              <Label className="text-xs font-medium text-muted-foreground">Business logo</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="h-9 rounded-lg"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                />
                {s.logo && (
                  <Button variant="outline" size="sm" onClick={() => s.setLogo(undefined)}>Clear</Button>
                )}
              </div>
            </div>
          </div>
          <Row label="Shop name">
            <Input value={s.shopName} onChange={(e) => s.setShopName(e.target.value)} className="h-11 rounded-xl" />
          </Row>
          <Row label="GSTIN">
            <Input value={s.gstin} onChange={(e) => s.setGstin(e.target.value)} className="h-11 rounded-xl tabular" />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Currency">
              <Select value={s.currency} onValueChange={s.setCurrency}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">₹ INR</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                  <SelectItem value="AED">د.إ AED</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Default tax %">
              <Input inputMode="numeric" value={s.taxRate} onChange={(e) => s.setTaxRate(Number(e.target.value) || 0)} className="h-11 rounded-xl tabular" />
            </Row>
          </div>
          <Row label="Store address">
            <Textarea rows={2} value={s.storeAddress} onChange={(e) => s.setStoreAddress(e.target.value)} />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Store phone">
              <Input value={s.storePhone} onChange={(e) => s.setStorePhone(e.target.value)} className="h-11 rounded-xl" />
            </Row>
            <Row label="Store email">
              <Input value={s.storeEmail} onChange={(e) => s.setStoreEmail(e.target.value)} className="h-11 rounded-xl" />
            </Row>
          </div>
        </div>

        {/* Printer + Theme */}
        <div className="space-y-4">
          <div className="card-soft space-y-4 p-5">
            <div>
              <div className="text-sm font-semibold">Printer</div>
              <div className="text-xs text-muted-foreground">Thermal slip destination</div>
            </div>
            <Select value={s.printer} onValueChange={(v) => s.setPrinter(v as typeof s.printer)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Internal POS">Internal POS</SelectItem>
                <SelectItem value="Bluetooth">Bluetooth</SelectItem>
                <SelectItem value="USB">USB</SelectItem>
              </SelectContent>
            </Select>
            <Row label="Paper width">
              <div className="grid grid-cols-2 gap-2">
                {(["58mm", "80mm"] as PaperWidth[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => s.setPaperWidth(w)}
                    className={`rounded-xl border p-3 text-sm font-medium transition-colors ${s.paperWidth === w ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted/60"}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </Row>
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={() => toast.success(`Test print sent`, { description: `Routed to ${s.printer} printer (${s.paperWidth}).` })}
            >
              <Printer className="mr-2 size-4" /> Test print
            </Button>
          </div>

          <div className="card-soft space-y-3 p-5">
            <div>
              <div className="text-sm font-semibold">Theme</div>
              <div className="text-xs text-muted-foreground">Choose Light, Dark, or match your system.</div>
            </div>
            <ThemeToggle variant="full" />
          </div>

          <div className="card-soft space-y-3 p-5">
            <div>
              <div className="text-sm font-semibold">Backup & restore</div>
              <div className="text-xs text-muted-foreground">Local-only snapshot of your data.</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => toast.success("Backup created", { description: "Saved to device storage." })}>
                <Download className="mr-2 size-4" /> Backup
              </Button>
              <Button variant="outline" onClick={() => toast.success("Restore ready", { description: "Choose a backup file to restore." })}>
                <Upload className="mr-2 size-4" /> Restore
              </Button>
            </div>
          </div>
        </div>

        {/* Receipt */}
        <div className="card-soft space-y-4 p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Receipt</div>
              <div className="text-xs text-muted-foreground">Live preview updates as you edit.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              s.setReceiptHeader("Thank you for shopping with us");
              s.setReceiptFooter("*** Thank you — visit again ***");
              toast.success("Reset to defaults");
            }}>
              <RotateCcw className="mr-1.5 size-3.5" /> Reset
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Row label="Receipt header">
                <Textarea rows={2} value={s.receiptHeader} onChange={(e) => s.setReceiptHeader(e.target.value)} />
              </Row>
              <Row label="Receipt footer">
                <Textarea rows={2} value={s.receiptFooter} onChange={(e) => s.setReceiptFooter(e.target.value)} />
              </Row>
              <Row label="UPI ID">
                <Input value={s.upiId} onChange={(e) => s.setUpiId(e.target.value)} className="h-11 rounded-xl" />
              </Row>
              <Row label="QR position">
                <RadioGroup
                  value={s.qrPosition}
                  onValueChange={(v) => s.setQrPosition(v as "Top" | "Bottom")}
                  className="grid grid-cols-2 gap-2"
                >
                  {(["Top", "Bottom"] as const).map((p) => (
                    <label
                      key={p}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-muted/40"
                    >
                      <RadioGroupItem value={p} />
                      {p}
                    </label>
                  ))}
                </RadioGroup>
              </Row>
            </div>
            <div className="grid place-items-center rounded-2xl bg-muted/30 p-4">
              <ReceiptPreview />
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="card-soft space-y-4 p-5 md:col-span-2">
          <div>
            <div className="text-sm font-semibold">Active role</div>
            <div className="text-xs text-muted-foreground">Switch roles to preview the permission matrix.</div>
          </div>
          <RadioGroup
            value={s.role}
            onValueChange={(v) => s.setRole(v as Role)}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
