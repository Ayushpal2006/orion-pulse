import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/store";
import type { Customer } from "@/lib/mock-data";
import { toast } from "sonner";

import { createCustomer as createCustomerApi, updateCustomer as updateCustomerApi } from "@/lib/api";

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  mode,
  defaultMobile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer?: Customer | null;
  mode: "add" | "edit";
  defaultMobile?: string;
  onSaved?: (c: Customer) => void;
}) {
  const addCustomer = useApp((s) => s.addCustomer);
  const updateCustomerStore = useApp((s) => s.updateCustomer);
  const [form, setForm] = useState<Customer>(() => blank());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        customer
          ? { ...customer }
          : { ...blank(), mobile: defaultMobile ?? "" },
      );
    }
  }, [open, customer, defaultMobile]);

  const upd = <K extends keyof Customer>(k: K, v: Customer[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.mobile) {
      toast.error("Name and mobile are required");
      return;
    }
    setSubmitting(true);
    try {
      const dto = {
        name: form.name,
        phone: form.mobile,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
      };

      if (mode === "add") {
        const saved = await createCustomerApi(dto);
        const frontendCust: Customer = {
          id: String(saved.id),
          name: saved.name,
          mobile: saved.phone,
          ltv: saved.lifetime_value / 100, // paise to Rs
          visits: saved.total_orders,
          lastVisit: saved.last_visit || "Never",
          since: new Date(saved.created_at).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }),
          email: saved.email || undefined,
          address: saved.address || undefined,
          notes: saved.notes || undefined,
        };
        addCustomer(frontendCust);
        toast.success(`${form.name} added`);
        onSaved?.(frontendCust);
      } else if (customer) {
        const saved = await updateCustomerApi(customer.id, dto);
        const frontendCust: Customer = {
          id: String(saved.id),
          name: saved.name,
          mobile: saved.phone,
          ltv: saved.lifetime_value / 100,
          visits: saved.total_orders,
          lastVisit: saved.last_visit || "Never",
          since: new Date(saved.created_at).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }),
          email: saved.email || undefined,
          address: saved.address || undefined,
          notes: saved.notes || undefined,
        };
        updateCustomerStore(customer.id, frontendCust);
        toast.success(`${form.name} updated`);
        onSaved?.(frontendCust);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "New customer" : "Edit customer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Mobile">
            <Input
              inputMode="numeric"
              maxLength={10}
              value={form.mobile}
              onChange={(e) => upd("mobile", e.target.value.replace(/\D/g, ""))}
              placeholder="10-digit mobile"
              className="tabular"
            />
          </Field>
          <Field label="Email">
            <Input value={form.email ?? ""} onChange={(e) => upd("email", e.target.value)} placeholder="name@example.com" />
          </Field>
          <Field label="Address">
            <Textarea value={form.address ?? ""} onChange={(e) => upd("address", e.target.value)} rows={2} />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes ?? ""} onChange={(e) => upd("notes", e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "add" ? "Add customer" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function blank(): Customer {
  return {
    id: `c${Math.floor(Math.random() * 1000000)}`,
    name: "",
    mobile: "",
    ltv: 0,
    visits: 0,
    lastVisit: "Never",
    since: new Date().toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }),
  };
}
