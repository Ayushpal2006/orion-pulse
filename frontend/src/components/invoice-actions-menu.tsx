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
import { Eye, Printer, FileText, Share2, Link, Copy, Trash2, Mail, RefreshCw, Send, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const [selectedReason, setSelectedReason] = useState("");
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
    const finalReason = selectedReason === "Other" ? voidReason : selectedReason;
    if (!finalReason) {
      toast.error("Please select or enter a reason to void the invoice");
      return;
    }
    const invoiceLast4 = invoiceNumber ? invoiceNumber.slice(-4) : "";
    if (confirmInvoiceNumber.trim() !== invoiceLast4) {
      toast.error("The last 4 digits of the invoice number do not match");
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
        body: JSON.stringify({ reason: finalReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to void invoice");
      }
      toast.success("Invoice voided successfully");
      setVoidDialogOpen(false);
      setConfirmInvoiceNumber("");
      setVoidReason("");
      setSelectedReason("");

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
      <Dialog open={voidDialogOpen} onOpenChange={(v) => {
        setVoidDialogOpen(v);
        if (!v) {
          setConfirmInvoiceNumber("");
          setVoidReason("");
          setSelectedReason("");
        }
      }}>
        <DialogContent className="sm:max-w-md rounded-2xl gap-4 p-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-rose-600 font-bold flex items-center gap-2 text-lg">
              <Trash2 className="size-5" /> Void Invoice
            </DialogTitle>
            <DialogDescription className="text-xs font-mono bg-muted/50 px-2.5 py-1 rounded-md border border-border w-fit text-foreground font-medium">
              Invoice #{invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          {/* Destructive Warning Alert Box */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3 text-xs text-rose-700 flex gap-2.5 shadow-sm">
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-rose-500" />
            <div className="space-y-1">
              <div className="font-bold text-rose-800">Critical Warning</div>
              <div className="leading-relaxed opacity-90">
                Voiding this transaction will restore stock levels, deduct customer loyalty spend/visits, and update the sheets ledger. This action is final.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Reason for voiding</label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger className="h-10 rounded-xl text-sm">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Customer Return">Customer Return</SelectItem>
                  <SelectItem value="Wrong Item Scanned">Wrong Item Scanned</SelectItem>
                  <SelectItem value="Wrong Quantity">Wrong Quantity</SelectItem>
                  <SelectItem value="Payment Cancelled">Payment Cancelled</SelectItem>
                  <SelectItem value="Duplicate Invoice">Duplicate Invoice</SelectItem>
                  <SelectItem value="Billing Mistake">Billing Mistake</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedReason === "Other" && (
              <div className="space-y-1 animate-fade-in">
                <label className="text-xs font-semibold text-foreground">Specify reason</label>
                <Textarea
                  placeholder="Enter details about why this invoice is being voided..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="rounded-xl min-h-[70px] text-sm focus-visible:ring-rose-500"
                />
              </div>
            )}

            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-foreground">
                Type the last 4 digits of the invoice number (<span className="font-mono text-rose-600 font-bold bg-rose-100/70 px-1.5 py-0.5 rounded">{invoiceNumber ? invoiceNumber.slice(-4) : ""}</span>) to confirm
              </label>
              <Input
                placeholder="Enter last 4 digits"
                maxLength={4}
                value={confirmInvoiceNumber}
                onChange={(e) => setConfirmInvoiceNumber(e.target.value)}
                className="h-10 rounded-xl font-mono text-sm uppercase text-center tracking-widest focus-visible:ring-rose-500"
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
                setSelectedReason("");
              }}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleVoidInvoice}
              disabled={
                voiding ||
                !selectedReason ||
                (selectedReason === "Other" && !voidReason.trim()) ||
                confirmInvoiceNumber !== (invoiceNumber ? invoiceNumber.slice(-4) : "")
              }
              className="rounded-xl h-9 text-xs font-bold shadow-sm"
            >
              {voiding ? "Voiding..." : "Confirm Void"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
