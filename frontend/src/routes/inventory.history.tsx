import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  History, Search, Calendar, RefreshCw, ArrowUpRight, ArrowDownRight, ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal, Package, Tag
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { useQuery } from "@tanstack/react-query";
import { getStockAdjustments } from "@/lib/api";

export const Route = createFileRoute("/inventory/history")({
  head: () => ({
    meta: [
      { title: "Stock History · Orion POS" },
      { name: "description", content: "Comprehensive audit trail of all inventory movements, adjustments, purchases, and sales." },
    ],
  }),
  component: StockHistoryPage,
});

function StockHistoryPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [movementType, setMovementType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [q]);

  // Query stock adjustments audit trail
  const { data: adjustments = [], isLoading, refetch } = useQuery({
    queryKey: ["stock-adjustments-history", debouncedQ, startDate, endDate, movementType],
    queryFn: () => getStockAdjustments({
      q: debouncedQ,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      adjustment_type: movementType === "all" ? undefined : movementType,
    }),
  });

  const totalPages = Math.ceil(adjustments.length / itemsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return adjustments.slice(start, start + itemsPerPage);
  }, [adjustments, page]);

  const stats = useMemo(() => {
    let positiveCount = 0;
    let negativeCount = 0;
    adjustments.forEach((a: any) => {
      if ((a.quantity_change ?? 0) >= 0) positiveCount++;
      else negativeCount++;
    });
    return {
      total: adjustments.length,
      positive: positiveCount,
      negative: negativeCount,
    };
  }, [adjustments]);

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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="size-6 text-primary" /> Stock History & Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete transactional ledger of manual stock adjustments, physical counts, and inventory corrections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Adjustments</div>
          <div className="mt-2 text-3xl font-black text-foreground">{stats.total}</div>
          <div className="mt-1 text-xs text-muted-foreground">Logged adjustment events</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="size-4" /> Stock Additions
          </div>
          <div className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.positive}</div>
          <div className="mt-1 text-xs text-muted-foreground">Opening stock, found, additions</div>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <ArrowDownRight className="size-4" /> Stock Reductions
          </div>
          <div className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-400">{stats.negative}</div>
          <div className="mt-1 text-xs text-muted-foreground">Damaged, lost, samples, write-offs</div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product name, SKU, or reason..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={movementType} onValueChange={(v) => { setMovementType(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SlidersHorizontal className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="OPENING_STOCK">Opening Stock</SelectItem>
              <SelectItem value="PHYSICAL_COUNT">Physical Count</SelectItem>
              <SelectItem value="DAMAGED">Damaged</SelectItem>
              <SelectItem value="LOST">Lost</SelectItem>
              <SelectItem value="FOUND">Found</SelectItem>
              <SelectItem value="MANUAL_CORRECTION">Manual Correction</SelectItem>
              <SelectItem value="SAMPLE">Sample</SelectItem>
              <SelectItem value="RETURN_FROM_CUSTOMER">Return from Customer</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="bg-transparent outline-none"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="size-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading stock audit history...</span>
          </div>
        ) : paginatedRows.length === 0 ? (
          <EmptyState
            icon={History}
            title="No Stock History Found"
            description="No stock adjustment logs match your active filters or search criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Before</th>
                  <th className="px-5 py-3.5 text-right">Change</th>
                  <th className="px-5 py-3.5 text-right">After</th>
                  <th className="px-5 py-3.5">Reason</th>
                  <th className="px-5 py-3.5">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedRows.map((row: any) => {
                  const isPositive = (row.quantity_change ?? 0) >= 0;
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-foreground">
                        {formatLocalDate(row.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-foreground">{row.product_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">SKU: {row.product_sku || "N/A"}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {row.adjustment_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">
                        {row.quantity_before}
                      </td>
                      <td className={`px-5 py-3.5 text-right font-mono font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {isPositive ? `+${row.quantity_change}` : row.quantity_change}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-foreground">
                        {row.quantity_after}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate">
                        {row.reason}
                        {row.notes && <span className="block text-xs italic text-muted-foreground">{row.notes}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {row.created_by || "System"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <div>
              Page {page} of {totalPages} ({adjustments.length} total entries)
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
