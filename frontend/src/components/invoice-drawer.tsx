import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { getSaleReceipt } from "@/lib/api";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoiceActionsMenu } from "./invoice-actions-menu";
import { inr } from "@/lib/format";
import { Loader2, Calendar, User, UserCheck, CreditCard, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export function InvoiceDrawer({
  invoiceNumber,
  open,
  onOpenChange,
}: {
  invoiceNumber: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isMobile, setIsMobile] = useState(false);

  // Dynamic window resizing to toggle between Bottom Sheet (mobile) and Right Drawer (desktop)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: receipt, isLoading } = useQuery({
    queryKey: ["receipt", invoiceNumber],
    queryFn: () => getSaleReceipt(invoiceNumber!),
    enabled: open && !!invoiceNumber,
  });

  const side = isMobile ? "bottom" : "right";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "w-full overflow-y-auto bg-background p-6 border-border flex flex-col justify-between",
          isMobile ? "h-[85vh] rounded-t-3xl" : "sm:max-w-md h-full"
        )}
      >
        <div className="space-y-6">
          <SheetHeader className="text-left border-b border-border pb-3 flex flex-row items-center justify-between">
            <div>
              <SheetTitle className="font-mono text-lg font-black tracking-tight">
                {invoiceNumber || "Invoice Details"}
              </SheetTitle>
              {receipt && (
                <div className="mt-1">
                  <InvoiceStatusBadge status={receipt.status} />
                </div>
              )}
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : !receipt ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Failed to load invoice details.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Void Banner */}
              {receipt.status === "VOID" && (
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 space-y-1.5 animate-pulse text-xs text-danger-foreground">
                  <div className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                    🔴 VOID TRANSACTION
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 mt-1 text-[11px]">
                    <div>Reason:</div>
                    <div className="font-medium text-foreground">{receipt.voidReason || "—"}</div>
                    <div>Voided By:</div>
                    <div className="font-medium text-foreground">{receipt.voidedBy || "—"}</div>
                    <div>Voided At:</div>
                    <div className="font-medium text-foreground">
                      {receipt.voidedAt ? new Date(receipt.voidedAt).toLocaleString("en-IN") : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Metadata Cards */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                    <Calendar className="size-3" /> Date & Time
                  </div>
                  <div className="font-semibold text-foreground">
                    {receipt.date} {receipt.time}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                    <UserCheck className="size-3" /> Cashier
                  </div>
                  <div className="font-semibold text-foreground">{receipt.cashier}</div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1 col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                    <User className="size-3" /> Customer
                  </div>
                  <div className="font-semibold text-foreground truncate">
                    {receipt.customer.name}
                  </div>
                  {receipt.customer.phone && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      +91 {receipt.customer.phone}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1 col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1 text-muted-foreground uppercase font-bold text-[9px] tracking-wider">
                    <CreditCard className="size-3" /> Payment Method
                  </div>
                  <div className="font-semibold text-foreground">{receipt.paymentMethod}</div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <ShoppingBag className="size-3.5" /> Billed Products
                </div>
                <div className="divide-y divide-border/60 max-h-[160px] overflow-y-auto pr-1">
                  {receipt.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between py-2 text-xs">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="font-medium text-foreground truncate">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.qty} x {inr(item.price)}
                        </div>
                      </div>
                      <div className="tabular text-right font-semibold text-foreground">
                        {inr(item.lineTotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grand Totals */}
              <div className="border-t border-border pt-4 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular font-semibold">{inr(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span>
                  <span className="tabular font-semibold text-danger">− {inr(receipt.discount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (GST)</span>
                  <span className="tabular font-semibold">{inr(receipt.gst)}</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-dashed border-border pt-2 text-foreground">
                  <span>Grand Total</span>
                  <span className="tabular text-money">{inr(receipt.grandTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Invoice Actions Footer */}
        {receipt && !isLoading && (
          <div className="border-t border-border pt-4 mt-6">
            <InvoiceActionsMenu
              receipt={receipt}
              onCloseDrawer={() => onOpenChange(false)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
