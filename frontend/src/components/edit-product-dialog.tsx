import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

  const upd = <K extends keyof Product>(k: K, v: Product[K]) => setForm((f) => ({ ...f, [k]: v }));

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

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (e: any) {
      toast.error("Failed to save product", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add new product" : "Edit product"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Add a new item to your store catalog."
              : "Update product details, pricing, and stock levels."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Image Upload Preview & Selector */}
          <div className="flex items-center gap-4 border p-3 rounded-lg bg-muted/20">
            <div className="w-16 h-16 rounded-md border border-dashed flex items-center justify-center overflow-hidden bg-background shrink-0 relative">
              {previewUrl || form.image ? (
                <img
                  src={previewUrl || form.image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl">{form.emoji || "📦"}</span>
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-medium text-muted-foreground block">
                Product Image (Max 5MB)
              </Label>
              <Input
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleFileChange}
                disabled={submitting}
                className="text-xs file:text-xs h-8 cursor-pointer"
              />
            </div>
          </div>

          <Field label="Product name *">
            <Input
              value={form.name}
              onChange={(e) => upd("name", e.target.value)}
              placeholder="e.g. Masala Dosa, Cold Drink"
              disabled={submitting}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <Input
                value={form.sku}
                onChange={(e) => upd("sku", e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Barcode">
              <Input
                value={form.barcode}
                onChange={(e) => upd("barcode", e.target.value)}
                placeholder="Optional"
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Input
                value={form.category}
                onChange={(e) => upd("category", e.target.value)}
                placeholder="Food, Drinks, etc."
                disabled={submitting}
              />
            </Field>
            <Field label="Icon / Emoji">
              <Input
                value={form.emoji}
                onChange={(e) => upd("emoji", e.target.value)}
                maxLength={4}
                disabled={submitting}
              />
            </Field>
          </div>

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
            <Field label="Selling price *">
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

          {/* Kitchen Order Ticket (KOT) Item Switch */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/10 shadow-xs">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Kitchen Item (KOT)</Label>
              <p className="text-xs text-muted-foreground">
                Routes to Kitchen printer ticket when ordered in POS billing
              </p>
            </div>
            <Switch
              checked={Boolean(form.is_kitchen_item)}
              onCheckedChange={(checked) => upd("is_kitchen_item", checked ? 1 : 0)}
              disabled={submitting}
            />
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
    is_kitchen_item: 0,
    emoji: "📦",
    createdAt: now,
    updatedAt: now,
  };
}
