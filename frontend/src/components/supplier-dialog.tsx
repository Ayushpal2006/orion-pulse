import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Supplier } from "@/lib/mock-data";
import { toast } from "sonner";
import { createSupplier as createSupplierApi, updateSupplier as updateSupplierApi } from "@/lib/api";

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplier?: Supplier | null;
  mode: "add" | "edit";
  onSaved?: (s: Supplier) => void;
}) {
  const [form, setForm] = useState<Partial<Supplier>>(() => blank());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        supplier
          ? { ...supplier }
          : blank(),
      );
    }
  }, [open, supplier]);

  const upd = <K extends keyof Supplier>(k: K, v: Supplier[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      toast.error("Operation not allowed while offline.");
      return;
    }
    if (!form.name) {
      toast.error("Name is required");
      return;
    }
    
    // Optional phone length check
    if (form.phone && form.phone.replace(/\D/g, "").length !== 10) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }

    // Optional GSTIN format check
    if (form.gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(form.gstin)) {
        toast.error("Invalid GSTIN format. Must be 15-character Indian GSTIN");
        return;
      }
    }

    setSubmitting(true);
    try {
      const dto = {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        gstin: form.gstin || null,
        address: form.address || null,
        notes: form.notes || null,
      };

      if (mode === "add") {
        const saved = await createSupplierApi(dto);
        const frontendSup: Supplier = {
          id: String(saved.id),
          name: saved.name,
          phone: saved.phone || undefined,
          email: saved.email || undefined,
          gstin: saved.gstin || undefined,
          address: saved.address || undefined,
          notes: saved.notes || undefined,
          isArchived: saved.is_archived === 1,
          createdAt: saved.created_at,
          updatedAt: saved.updated_at,
        };
        toast.success(`Supplier "${form.name}" added successfully`);
        onSaved?.(frontendSup);
      } else if (supplier) {
        const saved = await updateSupplierApi(supplier.id, dto);
        const frontendSup: Supplier = {
          id: String(saved.id),
          name: saved.name,
          phone: saved.phone || undefined,
          email: saved.email || undefined,
          gstin: saved.gstin || undefined,
          address: saved.address || undefined,
          notes: saved.notes || undefined,
          isArchived: saved.is_archived === 1,
          createdAt: saved.created_at,
          updatedAt: saved.updated_at,
        };
        toast.success(`Supplier "${form.name}" updated successfully`);
        onSaved?.(frontendSup);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save supplier");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "New supplier" : "Edit supplier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name (Required)">
            <Input value={form.name ?? ""} onChange={(e) => upd("name", e.target.value)} placeholder="Supplier name" />
          </Field>
          <Field label="Phone">
            <Input
              inputMode="numeric"
              maxLength={10}
              value={form.phone ?? ""}
              onChange={(e) => upd("phone", e.target.value.replace(/\D/g, ""))}
              placeholder="10-digit phone number"
              className="tabular"
            />
          </Field>
          <Field label="GSTIN">
            <Input
              value={form.gstin ?? ""}
              onChange={(e) => upd("gstin", e.target.value.toUpperCase())}
              placeholder="15-character GSTIN (e.g. 22AAAAA1111A1Z1)"
              maxLength={15}
            />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email ?? ""} onChange={(e) => upd("email", e.target.value)} placeholder="supplier@example.com" />
          </Field>
          <Field label="Address">
            <Textarea value={form.address ?? ""} onChange={(e) => upd("address", e.target.value)} rows={2} placeholder="Physical address" />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes ?? ""} onChange={(e) => upd("notes", e.target.value)} rows={2} placeholder="Payment details, terms, etc." />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "add" ? "Add supplier" : "Save"}
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

function blank(): Partial<Supplier> {
  return {
    name: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
    notes: "",
  };
}
