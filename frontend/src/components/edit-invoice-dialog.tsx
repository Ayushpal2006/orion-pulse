import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/store";
import { editInvoice, getProducts } from "@/lib/api";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Edit3, Search, ShoppingBag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface EditInvoiceDialogProps {
  receipt: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditInvoiceDialog({
  receipt,
  open,
  onOpenChange,
  onSuccess,
}: EditInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const allProducts = useApp((s) => s.products);

  const [items, setItems] = useState<
    { productId: number; name: string; price: number; qty: number; discount: number }[]
  >([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (receipt && open) {
      setItems(
        receipt.items.map((i: any) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          qty: i.qty,
          discount: i.discount || 0,
        }))
      );
      setCustomerPhone(receipt.customer?.phone || "");
      setCustomerName(receipt.customer?.name || "Walk-in Customer");
      setPaymentMethod(receipt.paymentMethod || "Cash");
      setDiscountAmount(receipt.discount || 0);
    }
  }, [receipt, open]);

  if (!receipt) return null;

  const handleQtyChange = (idx: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const newQty = Math.max(1, copy[idx].qty + delta);
      copy[idx] = { ...copy[idx], qty: newQty };
      return copy;
    });
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) {
      toast.error("Invoice must have at least one product item");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddProduct = (prod: any) => {
    const existingIdx = items.findIndex((i) => String(i.productId) === String(prod.id));
    if (existingIdx >= 0) {
      handleQtyChange(existingIdx, 1);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          price: (prod.selling_price || 0) / 100,
          qty: 1,
          discount: 0,
        },
      ]);
    }
    setProductSearch("");
  };

  const subtotal = items.reduce((acc, item) => acc + (item.price - item.discount) * item.qty, 0);
  const grandTotal = Math.max(0, subtotal - discountAmount);

  const filteredProducts = allProducts.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("At least one product item is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.qty,
          discount: i.discount,
        })),
        customerPhone: customerPhone.trim() || undefined,
        customerName: customerName.trim() || undefined,
        paymentMethod,
        discountAmount,
      };

      await editInvoice(receipt.invoiceNumber, payload);

      toast.success("Bill updated successfully");
      queryClient.invalidateQueries({ queryKey: ["receipt", receipt.invoiceNumber] });
      queryClient.invalidateQueries({ queryKey: ["sales-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight">
            <Edit3 className="size-5 text-primary" /> Edit Bill #{receipt.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 my-2">
          {/* Customer & Payment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Customer Mobile</Label>
              <Input
                placeholder="Phone (10 digits)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="h-9 rounded-xl text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Customer Name</Label>
              <Input
                placeholder="Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Wallet">Wallet</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Split">Split</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Search & Add */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Add Products to Bill</span>
              <span className="text-[10px] text-muted-foreground">{allProducts.length} active products</span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search product to add..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl text-xs"
              />
            </div>
            {productSearch.trim() && (
              <div className="max-h-36 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-surface">
                {filteredProducts.slice(0, 5).map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => handleAddProduct(prod)}
                    className="w-full px-3 py-2 text-left hover:bg-muted/30 flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{prod.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">Stock: {prod.stock}</span>
                    </div>
                    <span className="font-mono text-primary font-bold">{inr((prod.selling_price || 0) / 100)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Billed Items Table */}
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <ShoppingBag className="size-3.5" /> Billed Items ({items.length})
            </Label>
            <div className="divide-y divide-border/60 border border-border rounded-2xl p-2 bg-surface max-h-48 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-1 text-xs">
                  <div className="flex-1 pr-2 min-w-0">
                    <div className="font-semibold text-foreground truncate">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{inr(item.price)} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleQtyChange(idx, -1)}
                        className="size-6 rounded-md"
                      >
                        -
                      </Button>
                      <span className="w-6 text-center font-mono font-bold text-xs">{item.qty}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleQtyChange(idx, 1)}
                        className="size-6 rounded-md"
                      >
                        +
                      </Button>
                    </div>
                    <div className="w-16 text-right font-mono font-bold text-foreground">
                      {inr((item.price - item.discount) * item.qty)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(idx)}
                      className="size-7 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount & Totals */}
          <div className="border-t border-border pt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Subtotal</span>
              <span className="font-mono font-bold">{inr(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground font-medium">Overall Discount (₹)</span>
              <Input
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-28 h-8 rounded-lg text-right font-mono text-xs"
              />
            </div>
            <div className="flex items-center justify-between text-sm font-black border-t border-dashed border-border pt-2">
              <span>New Grand Total</span>
              <span className="font-mono text-money">{inr(grandTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-10">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl h-10 font-bold">
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
