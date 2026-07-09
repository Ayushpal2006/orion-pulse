import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp, type StockAdjustReason } from "@/lib/store";
import type { Product } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

export function StockAdjustmentDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const adjustStock = useApp((s) => s.adjustStock);
  const [mode, setMode] = useState<"inc" | "dec">("inc");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<StockAdjustReason>("Purchase");

  useEffect(() => {
    if (open) {
      setMode("inc");
      setQty(1);
      setReason("Purchase");
    }
  }, [open]);

  const submit = () => {
    if (!product) return;
    const delta = mode === "inc" ? qty : -qty;
    adjustStock(product.id, delta, reason);
    toast.success(
      `${mode === "inc" ? "+" : "−"}${qty} · ${product.name}`,
      { description: `${reason} · new stock: ${Math.max(0, product.stock + delta)}` },
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock · {product?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("inc")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium",
                mode === "inc" ? "border-success bg-success/10 text-success-foreground" : "border-border",
              )}
            >
              <ArrowUp className="size-4" /> Increase
            </button>
            <button
              onClick={() => setMode("dec")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium",
                mode === "dec" ? "border-danger bg-danger/10 text-danger" : "border-border",
              )}
            >
              <ArrowDown className="size-4" /> Decrease
            </button>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Quantity</Label>
            <Input
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as StockAdjustReason)}>
              <SelectTrigger className="mt-1 h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Purchase">Purchase</SelectItem>
                <SelectItem value="Damage">Damage</SelectItem>
                <SelectItem value="Return">Return</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Current stock: <span className="font-medium text-foreground">{product?.stock ?? 0}</span> →
            {" "}
            <span className="font-medium text-foreground">
              {Math.max(0, (product?.stock ?? 0) + (mode === "inc" ? qty : -qty))}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
