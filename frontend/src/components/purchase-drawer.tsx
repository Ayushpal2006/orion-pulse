import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getPurchaseById } from "@/lib/api";
import { PurchaseActionsMenu } from "./purchase-actions-menu";
import { inr } from "@/lib/format";
import { Loader2, Calendar, Building2, CreditCard, ShoppingBag, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PurchaseDrawer({
  purchaseId,
  open,
  onOpenChange,
  onEdit,
  onDuplicate,
}: {
  purchaseId: number | string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (id: number) => void;
  onDuplicate?: (id: number) => void;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: purchase, isLoading } = useQuery({
    queryKey: ["purchase-drawer", purchaseId],
    queryFn: () => getPurchaseById(purchaseId!),
    enabled: open && !!purchaseId,
  });

  const side = isMobile ? "bottom" : "right";

  if (!open) return null;

  const poNumber = purchase ? (purchase.po_number || purchase.purchase_number || `PO-#${purchase.id}`) : "Purchase Details";
  const status = purchase?.status || "COMPLETED";

  const getStatusBadge = () => {
    if (status === "VOID") return <Badge variant="destructive" className="font-bold text-xs">VOID</Badge>;
    if (status === "DELETED") return <Badge variant="destructive" className="font-bold text-xs bg-rose-900">DELETED</Badge>;
    if (status === "Draft") return <Badge variant="secondary" className="font-bold text-xs">DRAFT</Badge>;
    return <Badge className="bg-emerald-600 font-bold text-xs">COMPLETED</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "w-full overflow-y-auto bg-background p-6 border-border flex flex-col justify-between z-50",
          isMobile ? "h-[85vh] rounded-t-3xl" : "sm:max-w-md h-full"
        )}
      >
        <div className="space-y-6">
          <SheetHeader className="text-left border-b border-border pb-3 flex flex-row items-center justify-between">
            <div>
              <SheetTitle className="font-mono text-lg font-black tracking-tight flex items-center gap-2">
                <ShoppingBag className="size-5 text-primary" /> {poNumber}
              </SheetTitle>
              {purchase && (
                <div className="mt-1 flex items-center gap-2">
                  {getStatusBadge()}
                  {purchase.supplier_invoice_number && (
                    <span className="text-xs text-muted-foreground font-mono">
                      Inv: {purchase.supplier_invoice_number}
                    </span>
                  )}
                </div>
              )}
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : !purchase ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Failed to load purchase details.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Void Banner */}
              {status === "VOID" && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-1 text-xs text-rose-700">
                  <div className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                    <AlertTriangle className="size-4 text-rose-600" /> VOID PURCHASE ORDER
                  </div>
                  <div>Reason: {purchase.void_reason || "N/A"}</div>
                  <div>Voided By: {purchase.voided_by || "Admin"}</div>
                </div>
              )}

              {/* Summary Metadata Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                    <Building2 className="size-3" /> Supplier
                  </div>
                  <div className="font-semibold text-foreground truncate">{purchase.supplier_name || "N/A"}</div>
                  {purchase.supplier_phone && <div className="text-[10px] text-muted-foreground">{purchase.supplier_phone}</div>}
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                    <Calendar className="size-3" /> Purchase Date
                  </div>
                  <div className="font-semibold text-foreground">
                    {new Date(purchase.purchase_date || purchase.created_at).toLocaleDateString("en-IN")}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                    <CreditCard className="size-3" /> Payment Info
                  </div>
                  <div className="font-semibold text-foreground">
                    {purchase.payment_status || "Paid"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Method: {purchase.payment_method || "Cash"}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                    Invoice Number
                  </div>
                  <div className="font-mono font-semibold text-foreground">
                    {purchase.supplier_invoice_number || purchase.invoice_number || "N/A"}
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                  <span>Procured Items</span>
                  <span>({purchase.items?.length || 0})</span>
                </div>
                <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border text-xs">
                  <div className="bg-muted/40 px-3 py-2 grid grid-cols-12 font-bold text-[10px] uppercase text-muted-foreground">
                    <div className="col-span-6">Product</div>
                    <div className="col-span-3 text-center">Cost</div>
                    <div className="col-span-3 text-right">Total</div>
                  </div>
                  <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
                    {purchase.items?.map((item: any, idx: number) => {
                      const cost = item.purchase_price ? item.purchase_price / 100.0 : 0;
                      const lineTotal = item.line_total ? item.line_total / 100.0 : cost * item.quantity;
                      return (
                        <div key={idx} className="px-3 py-2 grid grid-cols-12 items-center">
                          <div className="col-span-6 font-semibold truncate text-foreground">
                            {item.product_name || `Item #${item.product_id}`}
                            <span className="block text-[10px] text-muted-foreground font-mono">Qty: {item.quantity}</span>
                          </div>
                          <div className="col-span-3 text-center font-mono text-muted-foreground">{inr(cost)}</div>
                          <div className="col-span-3 text-right font-mono font-bold text-foreground">{inr(lineTotal)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Financial Totals */}
              <div className="border-t border-border pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-foreground">{inr((purchase.subtotal || 0) / 100.0)}</span>
                </div>
                {purchase.discount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="font-mono font-semibold text-rose-600">-{inr((purchase.discount || 0) / 100.0)}</span>
                  </div>
                )}
                {purchase.gst > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST Tax</span>
                    <span className="font-mono font-semibold text-foreground">+{inr((purchase.gst || 0) / 100.0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-dashed border-border pt-2 text-foreground">
                  <span>Grand Total</span>
                  <span className="font-mono text-money text-base">{inr((purchase.grand_total || 0) / 100.0)}</span>
                </div>
              </div>

              {/* Purchase Actions Menu */}
              <PurchaseActionsMenu
                purchase={purchase}
                onCloseDrawer={() => onOpenChange(false)}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
