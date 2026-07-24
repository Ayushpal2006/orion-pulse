import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { toast } from "sonner";
import {
  voidPurchase,
  deletePurchase,
  downloadPurchasePdf,
  getPurchaseWhatsAppLink,
} from "@/lib/api";
import { Eye, Printer, FileText, Share2, Copy, Trash2, Pencil, AlertTriangle, RotateCcw } from "lucide-react";

export function PurchaseActionsMenu({
  purchase,
  onCloseDrawer,
  onEdit,
  onDuplicate,
}: {
  purchase: any;
  onCloseDrawer?: () => void;
  onEdit?: (id: number) => void;
  onDuplicate?: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const role = useApp((s) => s.role);

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [confirmPoNum, setConfirmPoNum] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!purchase) return null;

  const poNumber = purchase.po_number || purchase.purchase_number || `PO-#${purchase.id}`;
  const status = purchase.status || "COMPLETED";
  const isVoid = status === "VOID";
  const isDeleted = status === "DELETED";

  const handlePrint = () => {
    window.open(`/print/purchase/${purchase.id}`, "_blank");
    onCloseDrawer?.();
  };

  const handleView = () => {
    window.open(`/purchase/${purchase.id}`, "_blank");
    onCloseDrawer?.();
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
      toast.success("PDF downloaded");
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

  const handleConfirmVoid = async () => {
    const finalReason = selectedReason === "Other" ? voidReason.trim() : selectedReason;
    if (!finalReason) {
      toast.error("Please select or enter a reason for voiding");
      return;
    }
    const last4 = (poNumber || "").slice(-4);
    if (confirmPoNum.trim() !== last4) {
      toast.error("Last 4 digits of PO number do not match");
      return;
    }

    setVoiding(true);
    try {
      await voidPurchase(purchase.id, finalReason);
      toast.success(`Purchase ${poNumber} voided and stock reversed`);
      setVoidDialogOpen(false);
      setSelectedReason("");
      setVoidReason("");
      setConfirmPoNum("");
      onCloseDrawer?.();
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to void purchase");
    } finally {
      setVoiding(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await deletePurchase(purchase.id);
      toast.success(`Purchase ${poNumber} soft-deleted`);
      setDeleteDialogOpen(false);
      onCloseDrawer?.();
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete purchase");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        Purchase Order Actions
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* View Dedicated Page */}
        <Button variant="outline" size="sm" onClick={handleView} className="h-10 rounded-xl justify-start gap-2 text-xs font-semibold">
          <Eye className="size-4 text-primary" /> View Invoice Page
        </Button>

        {/* Edit */}
        {!isVoid && !isDeleted && onEdit && (
          <Button variant="outline" size="sm" onClick={() => { onEdit(purchase.id); onCloseDrawer?.(); }} className="h-10 rounded-xl justify-start gap-2 text-xs font-semibold">
            <Pencil className="size-4 text-amber-500" /> Edit Purchase
          </Button>
        )}

        {/* Duplicate */}
        {onDuplicate && (
          <Button variant="outline" size="sm" onClick={() => { onDuplicate(purchase.id); onCloseDrawer?.(); }} className="h-10 rounded-xl justify-start gap-2 text-xs font-semibold">
            <Copy className="size-4 text-purple-500" /> Duplicate Draft
          </Button>
        )}

        {/* Print */}
        <Button variant="outline" size="sm" onClick={handlePrint} className="h-10 rounded-xl justify-start gap-2 text-xs font-semibold">
          <Printer className="size-4 text-foreground" /> Print Voucher
        </Button>

        {/* Download PDF */}
        <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="h-10 rounded-xl justify-start gap-2 text-xs font-semibold">
          <FileText className="size-4 text-blue-500" /> Download PDF
        </Button>

        {/* Share WhatsApp */}
        <Button variant="outline" size="sm" onClick={handleWhatsApp} className="h-10 rounded-xl justify-start gap-2 text-xs font-semibold text-green-600 border-green-500/20 hover:bg-green-500/10">
          <Share2 className="size-4 text-green-500" /> Share WhatsApp
        </Button>

        {/* Void */}
        {!isVoid && !isDeleted && (
          <Button variant="outline" size="sm" onClick={() => setVoidDialogOpen(true)} className="h-10 rounded-xl justify-start gap-2 text-xs font-semibold text-rose-600 border-rose-500/20 hover:bg-rose-500/10">
            <RotateCcw className="size-4 text-rose-500" /> Void Purchase
          </Button>
        )}
      </div>

      {/* Void Confirmation Dialog */}
      <Dialog
        open={voidDialogOpen}
        onOpenChange={(v) => {
          setVoidDialogOpen(v);
          if (!v) {
            setSelectedReason("");
            setVoidReason("");
            setConfirmPoNum("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-rose-600 font-bold flex items-center gap-2">
              <AlertTriangle className="size-5" /> Void Purchase Order
            </DialogTitle>
            <DialogDescription className="text-xs">
              Voiding this order will reverse stock increases and deduct the amount from the supplier's balance ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Select Void Reason *</label>
              <Select
                value={selectedReason}
                onValueChange={(val) => {
                  setSelectedReason(val);
                  if (val !== "Other") {
                    setVoidReason(val);
                  } else {
                    setVoidReason("");
                  }
                }}
              >
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue placeholder="Choose predefined reason..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Wrong Entry">Wrong Entry</SelectItem>
                  <SelectItem value="Duplicate Purchase">Duplicate Purchase</SelectItem>
                  <SelectItem value="Wrong Supplier">Wrong Supplier</SelectItem>
                  <SelectItem value="Wrong Quantity">Wrong Quantity</SelectItem>
                  <SelectItem value="Wrong Price">Wrong Price</SelectItem>
                  <SelectItem value="Stock Entry Mistake">Stock Entry Mistake</SelectItem>
                  <SelectItem value="Supplier Returned Goods">Supplier Returned Goods</SelectItem>
                  <SelectItem value="Test Entry">Test Entry</SelectItem>
                  <SelectItem value="Cancelled Purchase">Cancelled Purchase</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedReason === "Other" && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <label className="text-xs font-semibold">Custom Reason *</label>
                <Textarea
                  placeholder="Enter custom void reason..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="rounded-xl min-h-[60px] text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold">
                Type last 4 digits of PO (<span className="font-mono text-rose-600 font-bold">{(poNumber || "").slice(-4)}</span>) to confirm
              </label>
              <Input
                placeholder="Enter last 4 digits"
                maxLength={4}
                value={confirmPoNum}
                onChange={(e) => setConfirmPoNum(e.target.value)}
                className="h-9 rounded-xl font-mono text-xs text-center tracking-widest uppercase"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVoidDialogOpen(false);
                setSelectedReason("");
                setVoidReason("");
                setConfirmPoNum("");
              }}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmVoid}
              disabled={
                voiding ||
                !selectedReason ||
                (selectedReason === "Other" && !voidReason.trim()) ||
                confirmPoNum.trim() !== (poNumber || "").slice(-4)
              }
              className="rounded-xl h-9 text-xs font-bold"
            >
              {voiding ? "Voiding..." : "Confirm Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
