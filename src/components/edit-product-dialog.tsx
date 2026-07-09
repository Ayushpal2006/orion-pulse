import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import type { Product } from "@/lib/mock-data";

export function EditProductDialog({
  open,
  onOpenChange,
  product,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
  mode: "add" | "edit";
}) {
  const addProduct = useApp((s) => s.addProduct);
  const updateProduct = useApp((s) => s.updateProduct);

  const [form, setForm] = useState<Product>(() => blank());

  useEffect(() => {
    if (open) setForm(product ? { ...product } : blank());
  }, [open, product]);

  const upd = <K extends keyof Product>(k: K, v: Product[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name || !form.price) {
      toast.error("Name and selling price are required");
      return;
    }
    if (mode === "add") {
      const now = new Date().toISOString();
      addProduct({ ...form, id: `p${Math.floor(Math.random() * 1000000)}`, createdAt: now, updatedAt: now });
      toast.success(`${form.name} added`, { description: `SKU ${form.sku}` });
    } else if (product) {
      updateProduct(product.id, form);
      toast.success(`${form.name} updated`);
    }
    onOpenChange(false);
  };

  const readImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => upd("image", reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "New product" : "Edit product"}</DialogTitle>
          <DialogDescription>All fields are optional except name & selling price.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid size-14 place-items-center overflow-hidden rounded-xl bg-muted text-2xl">
              {form.image ? (
                <img src={form.image} alt="" className="size-full object-cover" />
              ) : (
                <span>{form.emoji || "📦"}</span>
              )}
            </div>
            <div className="flex-1">
              <Label className="text-xs font-medium text-muted-foreground">Product image</Label>
              <Input
                type="file"
                accept="image/*"
                className="mt-1 h-9 rounded-lg"
                onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])}
              />
            </div>
          </div>

          <Field label="Product name">
            <Input value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Denim Jacket" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <Input value={form.sku} onChange={(e) => upd("sku", e.target.value)} />
            </Field>
            <Field label="Barcode">
              <Input value={form.barcode} onChange={(e) => upd("barcode", e.target.value)} />
            </Field>
          </div>
          <Field label="Category">
            <Input value={form.category} onChange={(e) => upd("category", e.target.value)} placeholder="Shirts" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase price">
              <Input
                inputMode="numeric"
                value={form.purchase || ""}
                onChange={(e) => upd("purchase", Number(e.target.value) || 0)}
                placeholder="₹"
              />
            </Field>
            <Field label="Selling price">
              <Input
                inputMode="numeric"
                value={form.price || ""}
                onChange={(e) => upd("price", Number(e.target.value) || 0)}
                placeholder="₹"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="GST %">
              <Input
                inputMode="numeric"
                value={form.gst}
                onChange={(e) => upd("gst", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Opening stock">
              <Input
                inputMode="numeric"
                value={form.stock}
                onChange={(e) => upd("stock", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Min stock">
              <Input
                inputMode="numeric"
                value={form.reorder}
                onChange={(e) => upd("reorder", Number(e.target.value) || 0)}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{mode === "add" ? "Add product" : "Save changes"}</Button>
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

function blank(): Product {
  const now = new Date().toISOString();
  const rid = Math.floor(Math.random() * 100000);
  return {
    id: `p${rid}`,
    name: "",
    sku: `NEW-${rid}`,
    barcode: String(8900000000000 + Math.floor(Math.random() * 999999)),
    category: "General",
    purchase: 0,
    price: 0,
    gst: 12,
    stock: 0,
    reorder: 5,
    emoji: "📦",
    createdAt: now,
    updatedAt: now,
  };
}
