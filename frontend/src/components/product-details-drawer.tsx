import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StockBadge } from "@/components/stock-badge";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/mock-data";
import { Pencil, Copy, Trash2, ScanBarcode, Boxes } from "lucide-react";

export function ProductDetailsDrawer({
  product,
  open,
  onOpenChange,
  onEdit,
  onAdjust,
  onBarcode,
  onDuplicate,
  onDelete,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: () => void;
  onAdjust: () => void;
  onBarcode: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Product details</SheetTitle>
        </SheetHeader>
        {product && (
          <div className="mt-4 space-y-5 px-4 pb-6">
            <div className="flex items-center gap-4">
              <div className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-muted text-4xl">
                {product.image ? (
                  <img src={product.image} alt="" className="size-full object-cover" />
                ) : (
                  <span>{product.emoji}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{product.name}</div>
                <div className="text-xs text-muted-foreground">{product.category}</div>
                <div className="mt-1"><StockBadge product={product} /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info label="SKU" value={product.sku} />
              <Info label="Barcode" value={product.barcode} mono />
              <Info label="Purchase" value={inr(product.purchase)} />
              <Info label="Selling" value={inr(product.price)} money />
              <Info label="GST" value={`${product.gst}%`} />
              <Info label="Stock" value={String(product.stock)} />
              <Info label="Min stock" value={String(product.reorder)} />
              <Info label="Created" value={new Date(product.createdAt).toLocaleDateString()} />
              <Info label="Updated" value={new Date(product.updatedAt).toLocaleDateString()} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11 rounded-xl" onClick={onEdit}>
                <Pencil className="mr-2 size-4" /> Edit
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={onAdjust}>
                <Boxes className="mr-2 size-4" /> Adjust stock
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={onBarcode}>
                <ScanBarcode className="mr-2 size-4" /> Print barcode
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={onDuplicate}>
                <Copy className="mr-2 size-4" /> Duplicate
              </Button>
              <Button
                variant="outline"
                className="col-span-2 h-11 rounded-xl border-danger/40 text-danger hover:bg-danger/10"
                onClick={onDelete}
              >
                <Trash2 className="mr-2 size-4" /> Delete product
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value, mono, money }: { label: string; value: string; mono?: boolean; money?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 truncate text-sm font-medium ${mono ? "font-mono tabular" : ""} ${money ? "text-money" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
