import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, Calendar, Plus, Loader2, ArrowUpDown, ChevronLeft, ChevronRight, X,
  Check, Sliders, AlertCircle, Info, CalendarDays, ClipboardCheck, AlertOctagon, HelpCircle, RefreshCw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStockAdjustments, createStockAdjustment, getProducts } from "@/lib/api";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/stock-adjustments")({
  head: () => ({
    meta: [
      { title: "Stock Adjustments · Orion POS" },
      { name: "description", content: "Perform manual stock checks, corrections, and physical audits with full logging." },
    ],
  }),
  component: StockAdjustmentsPage,
});

const ADJUSTMENT_TYPES = [
  { key: "OPENING_STOCK", label: "Opening Stock", color: "bg-emerald-500/10 text-emerald-500" },
  { key: "PHYSICAL_COUNT", label: "Physical Count", color: "bg-blue-500/10 text-blue-500" },
  { key: "DAMAGED", label: "Damaged", color: "bg-rose-500/10 text-rose-500" },
  { key: "LOST", label: "Lost", color: "bg-amber-500/10 text-amber-500" },
  { key: "FOUND", label: "Found", color: "bg-teal-500/10 text-teal-500" },
  { key: "MANUAL_CORRECTION", label: "Manual Correction", color: "bg-purple-500/10 text-purple-500" },
  { key: "SAMPLE", label: "Sample", color: "bg-indigo-500/10 text-indigo-500" },
  { key: "RETURN_FROM_CUSTOMER", label: "Return from Customer", color: "bg-cyan-500/10 text-cyan-500" },
] as const;

function StockAdjustmentsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // New adjustment states
  const [addOpen, setAddOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  const [productId, setProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);

  const [adjType, setAdjType] = useState<string>("PHYSICAL_COUNT");
  const [qtyChange, setQtyChange] = useState<number>(0);
  const [actualCount, setActualCount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [detailsTarget, setDetailsTarget] = useState<any | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [q]);

  // Load adjustments
  const { data: adjustments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["stock-adjustments", debouncedQ, startDate, endDate, filterType],
    queryFn: () => getStockAdjustments({
      q: debouncedQ,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      adjustment_type: filterType === "all" ? undefined : filterType,
    }),
  });

  const { data: productsList = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: () => getProducts(),
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
  };

  // Convert Date strings to local timezone readable
  const formatLocalDate = (isoStr: string) => {
    if (!isoStr) return "-";
    try {
      return new Date(isoStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  // Autocomplete filtering
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productsList;
    const p = productSearch.toLowerCase();
    return productsList.filter(
      (prod: any) =>
        prod.name.toLowerCase().includes(p) ||
        prod.sku.toLowerCase().includes(p) ||
        (prod.barcode && prod.barcode.includes(p))
    );
  }, [productSearch, productsList]);

  // Selected product metadata helper
  const selectedProduct = useMemo(() => {
    return productsList.find((p: any) => Number(p.id) === productId) || null;
  }, [productId, productsList]);

  // Calculations for live preview
  const livePreview = useMemo(() => {
    if (!selectedProduct) return null;
    const current = selectedProduct.stock;
    let change = qtyChange;
    if (adjType === "PHYSICAL_COUNT") {
      change = actualCount - current;
    }
    const newStock = current + change;
    return {
      current,
      change,
      newStock,
      isNegative: newStock < 0,
    };
  }, [selectedProduct, adjType, qtyChange, actualCount]);

  // Setup actualCount initially when product is selected
  useEffect(() => {
    if (selectedProduct && adjType === "PHYSICAL_COUNT") {
      setActualCount(selectedProduct.stock);
    }
  }, [selectedProduct, adjType]);

  const handleResetForm = () => {
    setProductId(null);
    setProductSearch("");
    setAdjType("PHYSICAL_COUNT");
    setQtyChange(0);
    setActualCount(0);
    setReason("");
    setNotes("");
  };

  const handleOpenAdd = () => {
    handleResetForm();
    setAddOpen(true);
  };

  const handlePreSave = () => {
    if (!productId) {
      toast.error("Please select a product");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please specify a reason");
      return;
    }
    if (livePreview?.isNegative) {
      toast.error("Stock adjustment cannot result in negative stock");
      return;
    }
    if (livePreview?.change === 0) {
      toast.error("Stock change must be non-zero");
      return;
    }
    setConfirmOpen(true);
  };

  const handleSave = async () => {
    setConfirmOpen(false);
    const payload = {
      product_id: productId,
      adjustment_type: adjType,
      quantity_change: adjType === "PHYSICAL_COUNT" ? undefined : qtyChange,
      actual_count: adjType === "PHYSICAL_COUNT" ? actualCount : undefined,
      reason: reason.trim(),
      notes: notes || null,
    };

    try {
      await createStockAdjustment(payload);
      toast.success("Stock adjusted and audit history saved successfully");
      setAddOpen(false);
      handleResetForm();
      handleRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to save stock adjustment");
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const totalCount = adjustments.length;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayAdjustments = adjustments.filter((a: any) => {
      const aDate = new Date(a.created_at);
      return aDate >= startOfToday;
    });

    const netQuantityChange = todayAdjustments.reduce((acc: number, a: any) => acc + (a.quantity_change || 0), 0);

    return {
      totalCount,
      todayCount: todayAdjustments.length,
      netQuantityChange,
    };
  }, [adjustments]);

  // Local Pagination
  const paginatedAdjustments = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return adjustments.slice(start, start + itemsPerPage);
  }, [adjustments, page]);
  const totalPages = Math.ceil(adjustments.length / itemsPerPage);

  const getBadgeColor = (type: string) => {
    const matched = ADJUSTMENT_TYPES.find((t) => t.key === type);
    return matched ? matched.color : "bg-muted text-muted-foreground";
  };

  const getFormattedType = (type: string) => {
    const matched = ADJUSTMENT_TYPES.find((t) => t.key === type);
    return matched ? matched.label : type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Stock Adjustments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Correct inventory counts, record damages, lost stock, and audit physical quantities.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-11" onClick={handleRefresh}>
            <RefreshCw className="size-4" />
          </Button>
          <Button onClick={handleOpenAdd} className="h-11 rounded-xl">
            <Plus className="mr-2 size-4" /> Adjust Stock
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><ClipboardCheck className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.todayCount}</div>
            <div className="text-[10px] text-muted-foreground font-medium">Today's Adjustments</div>
          </div>
        </div>
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-teal-500/10 text-teal-500 grid place-items-center"><ArrowUpDown className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.netQuantityChange > 0 ? `+${stats.netQuantityChange}` : stats.netQuantityChange}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium">Today's Net Qty Change</div>
          </div>
        </div>
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-purple-500/10 text-purple-500 grid place-items-center"><CalendarDays className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.totalCount}</div>
            <div className="text-[10px] text-muted-foreground font-medium">Total Adjustment Logs</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-soft p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product name or reason..."
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
            <SelectTrigger className="h-11 rounded-xl w-48">
              <Sliders className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="Adjustment Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ADJUSTMENT_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">From</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="h-11 rounded-xl w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">To</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="h-11 rounded-xl w-36"
            />
          </div>
          {(startDate || endDate) && (
            <Button
              variant="outline"
              onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }}
              className="h-11 rounded-xl"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* History Log */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="text-sm font-semibold text-foreground">Adjustment history could not be loaded</div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 size-4" /> Retry
          </Button>
        </div>
      ) : adjustments.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-5" />}
          title="No adjustments found"
          description="Adjustments logged for manual corrections, physical counts, lost or found stock will appear here."
          action={<Button onClick={handleOpenAdd}><Plus className="mr-2 size-4" /> Adjust Stock</Button>}
        />
      ) : (
        <div className="space-y-4">
          <div className="card-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                    <th className="p-4">Date</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-center">Previous Qty</th>
                    <th className="p-4 text-center">Change</th>
                    <th className="p-4 text-center">New Qty</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedAdjustments.map((a: any) => (
                    <tr key={a.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 text-xs text-muted-foreground">{formatLocalDate(a.created_at)}</td>
                      <td className="p-4">
                        <div className="font-semibold text-foreground">{a.product_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">SKU: {a.product_sku}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${getBadgeColor(a.adjustment_type)}`}>
                          {getFormattedType(a.adjustment_type)}
                        </span>
                      </td>
                      <td className="p-4 text-center font-medium tabular-nums">{a.quantity_before}</td>
                      <td className={`p-4 text-center font-bold tabular-nums ${a.quantity_change > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {a.quantity_change > 0 ? `+${a.quantity_change}` : a.quantity_change}
                      </td>
                      <td className="p-4 text-center font-medium tabular-nums">{a.quantity_after}</td>
                      <td className="p-4 text-xs truncate max-w-[200px]" title={a.reason}>{a.reason}</td>
                      <td className="p-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg"
                          onClick={() => setDetailsTarget(a)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <div className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({adjustments.length} adjustment entries)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="rounded-lg h-9 w-9 p-0"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="rounded-lg h-9 w-9 p-0"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjust Stock Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-semibold">Create Stock Adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Product Selector */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Select Product</label>
              <div className="relative">
                <Input
                  id="adj-product-search"
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setProductOpen(true); }}
                  onFocus={() => setProductOpen(true)}
                  placeholder={selectedProduct ? selectedProduct.name : "Search product by SKU, name, or barcode..."}
                  className="h-11 rounded-xl"
                />
                {selectedProduct && (
                  <button
                    onClick={() => { setProductId(null); setProductSearch(""); }}
                    className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
                {productOpen && productSearch.trim() && (
                  <div className="absolute top-12 left-0 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg z-50 p-2">
                    <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground text-center">No products found</div>
                      ) : (
                        filteredProducts.map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setProductId(p.id);
                              setProductSearch(p.name);
                              setProductOpen(false);
                            }}
                            className="flex w-full items-center justify-between p-2.5 text-xs text-left hover:bg-muted rounded-lg"
                          >
                            <div>
                              <div className="font-semibold">{p.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">SKU: {p.sku} | Barcode: {p.barcode || "-"}</div>
                            </div>
                            <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded-full text-foreground">Stock: {p.stock}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Current Stock Auto-fill (Read only indicator) */}
            {selectedProduct && (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-xl border">
                <Info className="size-4 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">
                  Current logged inventory count: <span className="font-bold text-foreground">{selectedProduct.stock} units</span>
                </div>
              </div>
            )}

            {/* Adjustment Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Adjustment Type</label>
              <Select value={adjType} onValueChange={setAdjType}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity inputs */}
            {adjType === "PHYSICAL_COUNT" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Actual Counted Stock (New Qty)</label>
                <Input
                  type="number"
                  min={0}
                  value={actualCount}
                  onChange={(e) => setActualCount(parseInt(e.target.value, 10) || 0)}
                  className="h-11 rounded-xl font-semibold text-center text-lg tabular"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Quantity Correction Change (+/-)</label>
                <Input
                  type="number"
                  value={qtyChange}
                  onChange={(e) => setQtyChange(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. +5 or -5"
                  className="h-11 rounded-xl font-semibold text-center text-lg tabular"
                />
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Reason (Required)</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Broken package, physical audit correction, sample items"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional audit notes (optional)..."
                rows={2}
                className="rounded-xl"
              />
            </div>

            {/* Live Preview Panel */}
            {livePreview && (
              <div className="p-3 bg-muted/20 border border-border border-dashed rounded-xl flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Preview Stock Transition</div>
                  <div className="flex items-center gap-2 mt-0.5 font-bold text-sm">
                    <span className="text-foreground">{livePreview.current}</span>
                    <span className="text-muted-foreground font-normal">→</span>
                    <span className={livePreview.isNegative ? "text-rose-500" : "text-primary font-extrabold"}>{livePreview.newStock} units</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground uppercase text-[10px] font-medium">Difference</div>
                  <div className={`font-bold text-sm mt-0.5 ${livePreview.change > 0 ? "text-emerald-500" : livePreview.change < 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                    {livePreview.change > 0 ? `+${livePreview.change}` : livePreview.change}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" className="rounded-xl h-11" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="rounded-xl h-11" onClick={handlePreSave}>
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stock Correction?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to adjust stock for product **{selectedProduct?.name}**.
              The stock will transition from **{livePreview?.current}** units to **{livePreview?.newStock}** units (difference of **{livePreview?.change && livePreview.change > 0 ? `+${livePreview.change}` : livePreview?.change}** units).
              An irreversible audit trail will be saved. Do you wish to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>Confirm & Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjustment Details Dialog */}
      <Dialog open={detailsTarget !== null} onOpenChange={(v) => !v && setDetailsTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-semibold">Stock Adjustment Details</DialogTitle>
          </DialogHeader>
          {detailsTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted/20 p-3 rounded-xl border">
                <div>
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Product</div>
                  <div className="font-semibold text-foreground text-sm mt-0.5">{detailsTarget.product_name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">SKU: {detailsTarget.product_sku}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Adjustment Type</div>
                  <div className="mt-0.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${getBadgeColor(detailsTarget.adjustment_type)}`}>
                      {getFormattedType(detailsTarget.adjustment_type)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Logged Date</div>
                  <div className="font-medium text-foreground mt-0.5">{formatLocalDate(detailsTarget.created_at)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Logged By</div>
                  <div className="font-medium text-foreground mt-0.5">{detailsTarget.created_by}</div>
                </div>
              </div>

              {/* Quantities Panel */}
              <div className="p-4 bg-muted/40 rounded-xl border border-dashed flex justify-around text-center text-xs">
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-semibold">Qty Before</div>
                  <div className="text-lg font-bold text-foreground tabular-nums mt-1">{detailsTarget.quantity_before}</div>
                </div>
                <div className="border-r border-border h-10 my-auto"></div>
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-semibold">Qty Change</div>
                  <div className={`text-lg font-black tabular-nums mt-1 ${detailsTarget.quantity_change > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {detailsTarget.quantity_change > 0 ? `+${detailsTarget.quantity_change}` : detailsTarget.quantity_change}
                  </div>
                </div>
                <div className="border-r border-border h-10 my-auto"></div>
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-semibold">Qty After</div>
                  <div className="text-lg font-bold text-primary tabular-nums mt-1">{detailsTarget.quantity_after}</div>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium uppercase text-[10px]">Audit Reason</span>
                <div className="p-3 bg-muted/10 border border-border/40 rounded-xl text-xs text-foreground font-medium">
                  {detailsTarget.reason}
                </div>
              </div>

              {/* Notes */}
              {detailsTarget.notes && (
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium uppercase text-[10px]">Internal Notes</span>
                  <div className="p-3 bg-muted/10 border border-border/40 rounded-xl text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {detailsTarget.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
