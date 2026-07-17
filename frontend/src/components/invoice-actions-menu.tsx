import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { toast } from "sonner";
import {
  getWhatsAppShareLink,
  downloadSalePdf,
  getSalePublicLink,
  printSaleReceipt,
  logSaleAudit,
  API_BASE_URL,
} from "@/lib/api";
import { getPrintAdapter } from "@/lib/print-adapter";
import { Eye, Printer, FileText, Share2, Link, Copy, Trash2, Mail, RefreshCw, Send } from "lucide-react";

export function InvoiceActionsMenu({
  receipt,
  onCloseDrawer,
}: {
  receipt: any;
  onCloseDrawer?: () => void;
}) {
  const queryClient = useQueryClient();
  const role = useApp((s) => s.role);
  const user = useApp((s) => s.role); // Role used as local identifier if username is unavailable

  const [printing, setPrinting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [confirmInvoiceNumber, setConfirmInvoiceNumber] = useState("");
  const [voiding, setVoiding] = useState(false);

  if (!receipt) return null;

  const invoiceNumber = receipt.invoiceNumber;
  const canVoid = role === "Admin" || role === "Manager";

  const handleViewReceipt = () => {
    logSaleAudit(invoiceNumber, "INVOICE_VIEW", `${role} viewed receipt HTML`);
    window.open(`/print/invoice/${invoiceNumber}`, "_blank");
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const adapter = getPrintAdapter();
      await adapter.print(receipt);
      toast.success("Receipt printed successfully");
      await logSaleAudit(invoiceNumber, "INVOICE_PRINT", `${role} printed Invoice ${invoiceNumber}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to print receipt");
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob = await downloadSalePdf(invoiceNumber);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully");
      await logSaleAudit(invoiceNumber, "INVOICE_PDF", `${role} downloaded PDF for ${invoiceNumber}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!receipt.customer?.phone) {
      toast.error("Customer phone number is required to share on WhatsApp");
      return;
    }
    try {
      const url = await getWhatsAppShareLink(invoiceNumber);
      window.open(url, "_blank");
      await logSaleAudit(invoiceNumber, "INVOICE_SHARE", `${role} shared invoice ${invoiceNumber} on WhatsApp`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate WhatsApp share link");
    }
  };

  const handleCopyLink = () => {
    if (!receipt.publicToken) {
      toast.error("No public link available for this invoice");
      return;
    }
    const link = getSalePublicLink(receipt.publicToken);
    navigator.clipboard
      .writeText(link)
      .then(() => {
        toast.success("Invoice link copied to clipboard");
      })
      .catch(() => {
        toast.error("Failed to copy link");
      });
  };

  const handleDuplicateInvoice = async () => {
    try {
      useApp.getState().clearCart();

      const storeProducts = useApp.getState().products;
      const duplicatedCartLines = receipt.items.map((item: any) => {
        const matchingProd = storeProducts.find((p) => String(p.id) === String(item.productId));
        return {
          productId: String(item.productId),
          name: item.name,
          price: item.price,
          gst: item.gst,
          qty: item.qty,
          discount: Math.round(item.discount * 100),
          emoji: matchingProd?.emoji || "🛍️",
        };
      });

      useApp.setState({
        cart: duplicatedCartLines,
        customerMobile: receipt.customer?.phone === "0000000000" ? "" : (receipt.customer?.phone || ""),
        customerName: receipt.customer?.name === "Walk-in Customer" ? "" : (receipt.customer?.name || ""),
        payment: receipt.paymentMethod,
      });

      await logSaleAudit(invoiceNumber, "INVOICE_DUPLICATE", `${role} duplicated Invoice ${invoiceNumber}`);
      toast.success("Invoice items and customer copied to checkout cart");
      if (onCloseDrawer) onCloseDrawer();
    } catch (err: any) {
      toast.error("Failed to duplicate invoice: " + err.message);
    }
  };

  const handleVoidInvoice = async () => {
    if (!voidReason) {
      toast.error("Please enter a reason to void the invoice");
      return;
    }
    if (confirmInvoiceNumber.trim().toUpperCase() !== invoiceNumber.toUpperCase()) {
      toast.error("Invoice number does not match confirmation input");
      return;
    }
    setVoiding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/invoices/${invoiceNumber}/void`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to void invoice");
      }
      toast.success("Invoice voided successfully");
      setVoidDialogOpen(false);
      setConfirmInvoiceNumber("");
      setVoidReason("");

      // Invalidate queries to refresh UI lists and charts
      queryClient.invalidateQueries({ queryKey: ["receipt", invoiceNumber] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customer-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales-paginated"] });

      if (onCloseDrawer) onCloseDrawer();
    } catch (err: any) {
      toast.error(err.message || "Failed to void invoice");
    } finally {
      setVoiding(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Invoice Actions
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button variant="outline" size="sm" onClick={handleViewReceipt} className="h-10 rounded-xl justify-start font-medium text-xs">
              <Eye className="mr-2 size-3.5 text-muted-foreground" /> View Receipt
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing} className="h-10 rounded-xl justify-start font-medium text-xs">
              <Printer className="mr-2 size-3.5 text-muted-foreground animate-pulse" />
              {printing ? "Printing..." : "Print"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="h-10 rounded-xl justify-start font-medium text-xs">
              <FileText className="mr-2 size-3.5 text-muted-foreground" />
              {downloadingPdf ? "Loading..." : "PDF Download"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsApp}
              disabled={!receipt.customer?.phone}
              className="h-10 rounded-xl justify-start font-medium text-xs disabled:opacity-50"
            >
              <Share2 className="mr-2 size-3.5 text-green-500" /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="h-10 rounded-xl justify-start font-medium text-xs">
              <Link className="mr-2 size-3.5 text-blue-500" /> Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleDuplicateInvoice} className="h-10 rounded-xl justify-start font-medium text-xs">
              <Copy className="mr-2 size-3.5 text-purple-500" /> Duplicate POS
            </Button>
          </div>
        </div>

        {receipt.status !== "VOID" && (
          <div className="border-t border-border pt-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!canVoid) {
                  toast.error("Only Admin or Manager accounts can void invoices");
                  return;
                }
                setVoidDialogOpen(true);
              }}
              className="w-full h-10 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 text-xs"
            >
              <Trash2 className="size-4" /> Void Invoice
            </Button>
          </div>
        )}

        {/* Future Placeholders */}
        <div className="border-t border-border/60 pt-3">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Future Features (Placeholders)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="ghost" disabled className="h-8 rounded-lg text-[10px] opacity-40 cursor-not-allowed justify-center font-normal">
              <RefreshCw className="mr-1 size-3" /> Refund
            </Button>
            <Button variant="ghost" disabled className="h-8 rounded-lg text-[10px] opacity-40 cursor-not-allowed justify-center font-normal">
              <Mail className="mr-1 size-3" /> Email
            </Button>
            <Button variant="ghost" disabled className="h-8 rounded-lg text-[10px] opacity-40 cursor-not-allowed justify-center font-normal">
              <Send className="mr-1 size-3" /> Export ERP
            </Button>
          </div>
        </div>
      </div>

      {/* Void Confirmation Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 font-bold flex items-center gap-2">
              <Trash2 className="size-5" /> Void Invoice {invoiceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Voiding this transaction will restore stock levels, subtract life-time value and orders count from the customer profile, and update sheets/ledger records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Reason for voiding</label>
              <Input
                placeholder="E.g., Customer return, billing error, payment change"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Type <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">{invoiceNumber}</span> to confirm
              </label>
              <Input
                placeholder="Enter invoice number exactly"
                value={confirmInvoiceNumber}
                onChange={(e) => setConfirmInvoiceNumber(e.target.value)}
                className="h-10 rounded-xl font-mono text-sm uppercase"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVoidDialogOpen(false);
                setConfirmInvoiceNumber("");
                setVoidReason("");
              }}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleVoidInvoice}
              disabled={voiding || !voidReason || confirmInvoiceNumber.toUpperCase() !== invoiceNumber.toUpperCase()}
              className="rounded-xl h-9 text-xs font-bold"
            >
              {voiding ? "Voiding..." : "Confirm Void"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
