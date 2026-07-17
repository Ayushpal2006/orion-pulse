import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StockBadge } from "@/components/stock-badge";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/mock-data";
import { Pencil, Copy, Trash2, ScanBarcode, Boxes, Loader2, ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getProductMovements } from "@/lib/api";

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
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["product-movements", product?.id],
    queryFn: () => getProductMovements(parseInt(product!.id, 10)),
    enabled: !!product && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Product details</SheetTitle>
        </SheetHeader>
        {product && (
          <div className="mt-4 space-y-5 px-1 pb-6 animate-fade-in">
            <div className="flex items-center gap-4 px-3">
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

            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="history">Stock History</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-5 px-2">
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

                <div className="grid grid-cols-2 gap-2 pt-2">
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
              </TabsContent>

              <TabsContent value="history" className="space-y-4 px-2">
                {isLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : movements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-2xl text-center space-y-2">
                    <ClipboardList className="size-8 text-muted-foreground/60" />
                    <div className="text-xs text-muted-foreground">No stock history recorded yet.</div>
                  </div>
                ) : (
                  <div className="relative border-l border-border pl-4 space-y-6 ml-2 my-2">
                    {movements.map((mov: any) => {
                      const isPositive = mov.quantity > 0;
                      const dateObj = new Date(mov.created_at);
                      const formattedDate = dateObj.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      });
                      const formattedTime = dateObj.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                      });

                      return (
                        <div key={mov.id} className="relative group">
                          <div className={`absolute -left-[21px] top-1.5 size-2 rounded-full border-2 bg-background ${
                            mov.movement_type === "SALE" || mov.movement_type === "PURCHASE_CANCEL" || mov.quantity < 0
                              ? "border-rose-500"
                              : "border-emerald-500"
                          }`} />
                          
                          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between mb-1">
                            <span>{formattedDate} · {formattedTime}</span>
                            <span className={`font-bold tabular ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                              {isPositive ? "+" : ""}{mov.quantity}
                            </span>
                          </div>

                          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5 shadow-sm">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground capitalize">
                                {mov.movement_type.toLowerCase().replace("_", " ")}
                              </span>
                              {mov.reference_id && (
                                <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                  {mov.reference_id}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-muted-foreground flex justify-between items-center">
                              <span>Stock: {mov.previous_stock} → {mov.new_stock}</span>
                              <span className="text-[10px] italic">by {mov.created_by || "System"}</span>
                            </div>

                            {mov.reason && (
                              <div className="text-[10px] text-muted-foreground/80 bg-muted/40 p-1.5 rounded-lg border border-border/20 truncate">
                                💬 {mov.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
