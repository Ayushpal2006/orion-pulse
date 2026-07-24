import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Printer, FileText, Share2, Building2, Calendar, ArrowLeft, AlertTriangle } from "lucide-react";
import { getPurchaseById, downloadPurchasePdf, getPurchaseWhatsAppLink } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/purchase/$id")({
  head: () => ({
    meta: [
      { title: "Purchase Details · Orion POS" },
      { name: "description", content: "View detailed purchase voucher, supplier info, and line items." },
    ],
  }),
  component: DedicatedPurchaseInvoicePage,
});

function DedicatedPurchaseInvoicePage() {
  const { id } = Route.useParams();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: purchase, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["purchase-detail-page", id],
    queryFn: () => getPurchaseById(id),
    staleTime: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mt-2 text-sm text-muted-foreground">Loading purchase order details...</span>
      </div>
    );
  }

  if (isError || !purchase) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center p-4 text-center">
        <h1 className="text-lg font-bold text-destructive">Failed to load purchase order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message || "Could not retrieve the requested purchase order."}
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => refetch()} className="rounded-xl h-10 px-4">
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl h-10 px-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.history.back()} className="rounded-xl h-10 px-3">
            <ArrowLeft className="mr-1.5 size-4" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Purchase Order {poNumber}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">Supplier Invoice: {supplierInvoice}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} className="rounded-xl h-10 text-xs">
            <Printer className="mr-1.5 size-4" /> Print View
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf} className="rounded-xl h-10 text-xs">
            <FileText className="mr-1.5 size-4 text-blue-500" /> Download PDF
          </Button>
          <Button variant="outline" onClick={handleWhatsApp} className="rounded-xl h-10 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10">
            <Share2 className="mr-1.5 size-4 text-green-500" /> Share WhatsApp
          </Button>
        </div>
      </div>

      {/* Invoice Document Card */}
      <div className="card-soft p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap justify-between items-start gap-4 border-b border-border pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">PO Voucher</div>
            <div className="text-2xl font-black text-foreground font-mono mt-1">{poNumber}</div>
            <div className="text-xs text-muted-foreground font-mono mt-1">Supplier Invoice Number: <span className="font-bold text-foreground">{supplierInvoice}</span></div>
          </div>
          <div className="text-right space-y-1">
            {getStatusBadge()}
            <div className="text-xs text-muted-foreground">
              Date: <span className="font-semibold text-foreground">{new Date(purchase.purchase_date || purchase.created_at).toLocaleDateString("en-IN")}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Payment: <span className="font-semibold text-foreground">{purchase.payment_status || "Paid"} ({purchase.payment_method || "Cash"})</span>
            </div>
          </div>
        </div>

        {/* Supplier Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 border border-border/60 rounded-2xl text-xs">
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground flex items-center gap-1">
              <Building2 className="size-3.5" /> Supplier Details
            </div>
            <div className="font-bold text-foreground text-sm">{purchase.supplier_name || "N/A"}</div>
            {purchase.supplier_phone && <div className="text-muted-foreground">Phone: {purchase.supplier_phone}</div>}
            {purchase.supplier_gstin && <div className="text-muted-foreground">GSTIN: {purchase.supplier_gstin}</div>}
          </div>
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3.5" /> Metadata
            </div>
            <div>Created By: <span className="font-medium text-foreground">{purchase.created_by || "System"}</span></div>
            <div>Created At: <span className="font-medium text-foreground">{new Date(purchase.created_at).toLocaleString("en-IN")}</span></div>
          </div>
        </div>

        {/* Void warning */}
        {status === "VOID" && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-700 flex gap-3">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Order Voided</div>
              <div>Reason: {purchase.void_reason || "N/A"} (Voided by {purchase.voided_by || "Admin"})</div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Line Items ({items.length})</div>
          <div className="border border-border/60 rounded-2xl overflow-hidden divide-y divide-border/60">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-12 text-[10px] font-bold text-muted-foreground uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Product Description</div>
              <div className="col-span-2 text-right">Purchase Cost</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Line Total</div>
            </div>
            <div className="divide-y divide-border/40">
              {items.map((item: any, idx: number) => {
                const pPrice = item.purchase_price ? item.purchase_price / 100.0 : 0;
                const lTotal = item.line_total ? item.line_total / 100.0 : pPrice * item.quantity;
                return (
                  <div key={idx} className="px-4 py-3 grid grid-cols-12 text-xs items-center">
                    <div className="col-span-1 text-muted-foreground font-mono">{idx + 1}</div>
                    <div className="col-span-5 font-semibold text-foreground">
                      {item.product_name || `Product #${item.product_id}`}
                      {item.product_sku && <span className="text-[10px] text-muted-foreground font-mono ml-1">({item.product_sku})</span>}
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
        <div className="border-t border-border pt-4 space-y-1.5 text-xs">
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
          <div className="flex justify-between text-base font-black border-t border-dashed border-border pt-3">
            <span>Grand Total</span>
            <span className="font-mono text-money text-lg">{inr((purchase.grand_total || 0) / 100.0)}</span>
          </div>
        </div>

        {purchase.notes && (
          <div className="p-3 bg-muted/20 rounded-xl text-xs text-muted-foreground border border-dashed border-border">
            <strong className="text-foreground block mb-0.5">Notes / Instructions:</strong>
            {purchase.notes}
          </div>
        )}
      </div>
    </div>
  );
}
