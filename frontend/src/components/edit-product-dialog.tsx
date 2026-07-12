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
import { createProduct, updateProduct as updateProductApi, uploadProductImage } from "@/lib/api";

export function EditProductDialog({
  open,
  onOpenChange,
  product,
  mode,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
  mode: "add" | "edit";
  onSuccess?: () => void;
}) {
  const addProduct = useApp((s) => s.addProduct);
  const updateProduct = useApp((s) => s.updateProduct);

  const [form, setForm] = useState<Product>(() => blank());
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(product ? { ...product } : blank());
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  }, [open, product]);

  // Clean up object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const upd = <K extends keyof Product>(k: K, v: Product[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large. Maximum size is 5 MB.");
        return;
      }
      if (!/image\/(jpeg|jpg|png|webp)/.test(file.type)) {
        toast.error("Only PNG, JPG, JPEG, and WebP formats are allowed.");
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const submit = async () => {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      toast.error("Operation not allowed while offline.");
      return;
    }
    if (!form.name || !form.price) {
      toast.error("Name and selling price are required");
      return;
    }
    setSubmitting(true);
    try {
      let finalProduct: Product | null = null;
      if (mode === "add") {
        const newProd = await createProduct(form);
        addProduct(newProd);
        finalProduct = newProd;
        toast.success(`${form.name} added`, { description: `SKU ${form.sku}` });
      } else if (product) {
        const updatedProd = await updateProductApi(product.id, form);
        updateProduct(product.id, updatedProd);
        finalProduct = updatedProd;
        toast.success(`${form.name} updated`);
      }

      // If a file was selected, upload the image
      if (finalProduct && selectedFile) {
        const uploadedUrl = await uploadProductImage(finalProduct.id, selectedFile);
        const productWithImage = { ...finalProduct, image: uploadedUrl };
        updateProduct(finalProduct.id, productWithImage);
      }

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save product. Please check server availability.");
    } finally {
      setSubmitting(false);
    }
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
            <div className="grid size-14 place-items-center overflow-hidden rounded-xl bg-muted text-2xl border border-border">
              {previewUrl || form.image ? (
                <img src={previewUrl || form.image} alt="" className="size-full object-cover" />
              ) : (
                <span>{form.emoji || "📦"}</span>
              )}
            </div>
            <div className="flex-1">
              <Label className="text-xs font-medium text-muted-foreground">Product image</Label>
              <Input
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="mt-1 h-9 rounded-lg text-xs"
                onChange={handleFileChange}
                disabled={submitting}
              />
            </div>
          </div>

          <Field label="Product name">
            <Input value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Denim Jacket" disabled={submitting} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <Input value={form.sku} onChange={(e) => upd("sku", e.target.value)} disabled={submitting} />
            </Field>
            <Field label="Barcode">
              <Input value={form.barcode} onChange={(e) => upd("barcode", e.target.value)} disabled={submitting} />
            </Field>
          </div>
          <Field label="Category">
            <Input value={form.category} onChange={(e) => upd("category", e.target.value)} placeholder="Shirts" disabled={submitting} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase price">
              <Input
                inputMode="numeric"
                value={form.purchase || ""}
                onChange={(e) => upd("purchase", Number(e.target.value) || 0)}
                placeholder="₹"
                disabled={submitting}
              />
            </Field>
            <Field label="Selling price">
              <Input
                inputMode="numeric"
                value={form.price || ""}
                onChange={(e) => upd("price", Number(e.target.value) || 0)}
                placeholder="₹"
                disabled={submitting}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="GST %">
              <Input
                inputMode="numeric"
                value={form.gst}
                onChange={(e) => upd("gst", Number(e.target.value) || 0)}
                disabled={submitting}
              />
            </Field>
            <Field label="Opening stock">
              <Input
                inputMode="numeric"
                value={form.stock}
                onChange={(e) => upd("stock", Number(e.target.value) || 0)}
                disabled={submitting}
              />
            </Field>
            <Field label="Min stock">
              <Input
                inputMode="numeric"
                value={form.reorder}
                onChange={(e) => upd("reorder", Number(e.target.value) || 0)}
                disabled={submitting}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "add" ? "Add product" : "Save changes"}
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
