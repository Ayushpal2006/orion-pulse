import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { downloadPurchasePdf, getPurchaseWhatsAppLink, buildImageUrl } from "@/lib/api";
import { toast } from "sonner";
import { Printer, FileText, Share2, Building2, Calendar, CreditCard, Tag, AlertTriangle, ShieldCheck } from "lucide-react";

interface PurchaseDetailsDialogProps {
  purchase: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseDetailsDialog({ purchase, open, onOpenChange }: PurchaseDetailsDialogProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!purchase) return null;

  const poNumber = purchase.po_number || purchase.purchase_number || `PO-#${purchase.id}`;
  const supplierInvoice = purchase.invoice_number || purchase.supplier_invoice_number || "N/A";
  const items = purchase.items || [];
  const status = purchase.status || "COMPLETED";

  const handlePrint = () => {
    window.open(`/print/purchase/${purchase.id}`, "_blank");
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob = await downloadPurchasePdf(purchase.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${poNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Purchase PDF downloaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleWhatsApp = async () => {
    try {
      const url = await getPurchaseWhatsAppLink(purchase.id);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate WhatsApp share link");
    }
  };

  const getStatusBadge = () => {
    if (status === "VOID") return <Badge variant="destructive" className="font-bold">VOID</Badge>;
    if (status === "DELETED") return <Badge variant="destructive" className="font-bold bg-rose-800">DELETED</Badge>;
    if (status === "Draft") return <Badge variant="secondary" className="font-bold">DRAFT</Badge>;
    return <Badge className="bg-emerald-600 font-bold hover:bg-emerald-700">COMPLETED</Badge>;
  };

  const getPaymentStatusBadge = () => {
    const ps = purchase.payment_status || "Paid";
    if (ps === "Paid") return <span className="text-emerald-600 font-bold text-xs">● Paid</span>;
    if (ps === "Partially Paid") return <span className="text-amber-600 font-bold text-xs">● Partially Paid</span>;
    return <span className="text-rose-600 font-bold text-xs">● Pending</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <Building2 className="size-5 text-primary" /> Purchase Order {poNumber}
            </DialogTitle>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Supplier Invoice: <span className="font-bold text-foreground">{supplierInvoice}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Supplier Info & PO Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 border border-border/60 rounded-2xl text-xs">
            <div className="space-y-1">
              <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground flex items-center gap-1">
                <Building2 className="size-3" /> Supplier Details
              </div>
              <div className="font-semibold text-foreground text-sm">{purchase.supplier_name || "N/A"}</div>
              {purchase.supplier_phone && <div className="text-muted-foreground">Phone: {purchase.supplier_phone}</div>}
              {purchase.supplier_gstin && <div className="text-muted-foreground">GSTIN: {purchase.supplier_gstin}</div>}
            </div>
            <div className="space-y-1">
              <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" /> Metadata & Status
              </div>
              <div>Date: <span className="font-medium text-foreground">{new Date(purchase.purchase_date || purchase.created_at).toLocaleDateString("en-IN")}</span></div>
              <div>Payment: {getPaymentStatusBadge()} ({purchase.payment_method || "Cash"})</div>
              <div>Created By: <span className="font-medium text-foreground">{purchase.created_by || "System"}</span></div>
            </div>
          </div>

          {/* Void / Delete Warning Banner */}
          {status === "VOID" && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-700 flex gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Order Voided</span> — Reason: {purchase.void_reason || "N/A"} (Voided by {purchase.voided_by || "Admin"})
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Procured Products ({items.length})
            </div>
            <div className="border border-border/60 rounded-2xl overflow-hidden divide-y divide-border/60">
              <div className="bg-muted/50 px-3 py-2 grid grid-cols-12 text-[10px] font-bold text-muted-foreground uppercase">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Product</div>
                <div className="col-span-2 text-right">Purchase Cost</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
                {items.map((item: any, idx: number) => {
                  const pPrice = item.purchase_price ? item.purchase_price / 100 : 0;
                  const lTotal = item.line_total ? item.line_total / 100 : pPrice * item.quantity;
                  return (
                    <div key={idx} className="px-3 py-2 grid grid-cols-12 text-xs items-center">
                      <div className="col-span-1 text-muted-foreground font-mono text-[10px]">{idx + 1}</div>
                      <div className="col-span-5 font-semibold truncate text-foreground flex items-center gap-2">
                        <div className="size-6 rounded-md overflow-hidden bg-muted/40 border border-border/50 shrink-0 flex items-center justify-center">
                          {item.product_image || item.image || item.image_url ? (
                            <img
                              src={buildImageUrl(item.product_image || item.image || item.image_url) || item.product_image || item.image || item.image_url}
                              alt={item.product_name}
                              className="size-full object-cover rounded-md"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="text-[10px]">🛍️</span>
                          )}
                        </div>
                        <div className="truncate">
                          <span>{item.product_name || `Product #${item.product_id}`}</span>
                          {item.product_sku && <span className="text-[10px] text-muted-foreground font-mono ml-1">({item.product_sku})</span>}
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-mono text-muted-foreground">{inr(pPrice)}</div>
                      <div className="col-span-2 text-center font-mono font-bold text-foreground">{item.quantity}</div>
                      <div className="col-span-2 text-right font-mono font-bold text-foreground">{inr(lTotal)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="border-t border-border pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono font-semibold text-foreground">{inr((purchase.subtotal || 0) / 100)}</span>
            </div>
            {purchase.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="font-mono font-semibold text-rose-600">-{inr((purchase.discount || 0) / 100)}</span>
              </div>
            )}
            {purchase.gst > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>GST Tax</span>
                <span className="font-mono font-semibold text-foreground">+{inr((purchase.gst || 0) / 100)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black border-t border-dashed border-border pt-2">
              <span>Grand Total</span>
              <span className="font-mono text-money">{inr((purchase.grand_total || 0) / 100)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <div className="flex flex-wrap gap-2 w-full justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl h-9 text-xs">
                <Printer className="mr-1.5 size-3.5" /> Print View
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="rounded-xl h-9 text-xs">
                <FileText className="mr-1.5 size-3.5" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleWhatsApp} className="rounded-xl h-9 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10">
                <Share2 className="mr-1.5 size-3.5 text-green-500" /> WhatsApp
              </Button>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-9 text-xs">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
