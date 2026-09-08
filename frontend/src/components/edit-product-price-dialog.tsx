import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { updateProduct as apiUpdateProduct } from "@/lib/api";
import { useApp, type Product } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { saveProductsOffline } from "@/lib/offline-db";
import { Tag, DollarSign, Check } from "lucide-react";

interface EditProductPriceDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updatedProduct: Product) => void;
}

export function EditProductPriceDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: EditProductPriceDialogProps) {
  const [newPrice, setNewPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const updateProductStore = useApp((s) => s.updateProduct);
  const products = useApp((s) => s.products);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (product) {
      const currentPrice = Number(product.price || (product as any).selling_price || 0);
      setNewPrice(currentPrice > 0 ? String(currentPrice) : "");
    }
  }, [product]);

  if (!product) return null;

  const currentPrice = Number(product.price || (product as any).selling_price || 0);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newPrice.trim();
    if (!trimmed) {
      toast.error("Please enter a valid price");
      return;
    }

    const priceNum = parseFloat(trimmed);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Price must be a valid number greater than or equal to 0");
      return;
    }

    setSaving(true);
    try {
      // 1. Optimistically update local Zustand store
      updateProductStore(product.id, { price: priceNum, selling_price: priceNum } as any);

      // 2. Persist to Backend API
      const updated = await apiUpdateProduct(product.id, {
        price: priceNum,
        selling_price: priceNum,
      } as any);

      // 3. Update React Query cache
      queryClient.setQueryData<Product[]>(["products"], (old) => {
        if (!old) return old;
        return old.map((p) =>
          p.id === product.id ? { ...p, price: priceNum, selling_price: priceNum } : p
        );
      });

      // 4. Update offline IndexedDB cache
      const updatedList = products.map((p) =>
        p.id === product.id ? { ...p, price: priceNum, selling_price: priceNum } : p
      );
      await saveProductsOffline(updatedList as any).catch(() => {});

      toast.success(`Price updated to ${inr(priceNum)} for ${product.name}`);
      onSuccess?.({ ...product, price: priceNum, selling_price: priceNum });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to update price:", err);
      toast.error(err.message || "Failed to update selling price");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold text-base mb-1">
            <Tag className="size-4" />
            <DialogTitle>Edit Selling Price</DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Update the catalog selling price for this product. Historical bills will preserve their original sale prices.
          </p>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 my-2">
          <div className="p-3 bg-muted/40 rounded-xl space-y-1">
            <div className="font-semibold text-foreground text-sm truncate">{product.name}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>SKU: {product.sku || "N/A"}</span>
              <span>Current Price: <strong className="text-foreground">{inr(currentPrice)}</strong></span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-edit-price" className="text-xs font-semibold">
              New Selling Price (₹)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                id="quick-edit-price"
                type="number"
                step="any"
                min="0"
                autoFocus
                placeholder="0.00"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="pl-8 h-10 text-base font-bold tabular rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {saving ? "Saving..." : (
                <>
                  <Check className="size-3.5" />
                  Save Price
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
