import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, Phone, Calendar, Sparkles, ChevronDown, Plus, Pencil, Trash2, Loader2, Truck, Star, RefreshCw, Mail, MapPin, Hash, ArrowUpDown, ChevronLeft, ChevronRight, Archive, Sliders, Landmark
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSuppliers, deleteSupplierApi, getSupplierLedger, createSupplierPayment } from "@/lib/api";
import { SupplierDialog } from "@/components/supplier-dialog";
import { inr } from "@/lib/format";

interface ExtendedSupplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  notes?: string;
  isArchived: boolean;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers · Apka Bill" },
      { name: "description", content: "Supplier CRM directory and stock procurement records." },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExtendedSupplier | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ExtendedSupplier | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Supplier payment states
  const [paymentTarget, setPaymentTarget] = useState<ExtendedSupplier | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().substring(0, 10));
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const handleRecordPayment = async () => {
    if (!paymentTarget) return;
    const amountVal = parseFloat(payAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const dto = {
        supplier_id: Number(paymentTarget.id),
        amount: Math.round(amountVal * 100), // Paise
        payment_method: payMethod,
        reference_number: payRef || null,
        payment_date: new Date(payDate).toISOString(),
        notes: payNotes || null,
      };

      await createSupplierPayment(dto);
      toast.success("Payment recorded successfully");
      setPaymentTarget(null);
      setPayAmount("");
      setPayRef("");
      setPayNotes("");
      handleRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to record payment");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1); // Reset page on search
    }, 300);
    return () => clearTimeout(handler);
  }, [q]);

  // Load all suppliers (both active and archived) for stats computation and local pagination
  const { data: rawSuppliers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["suppliers-all", debouncedQ, sort, showArchived],
    queryFn: () => getSuppliers(debouncedQ, sort, true), // fetch all to do frontend counts
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["suppliers-all"] });
  };

  // Convert backend structure to frontend structure
  const mappedSuppliers: ExtendedSupplier[] = useMemo(() => {
    return rawSuppliers.map((s: any) => ({
      id: String(s.id),
      name: s.name,
      phone: s.phone || undefined,
      email: s.email || undefined,
      gstin: s.gstin || undefined,
      address: s.address || undefined,
      notes: s.notes || undefined,
      isArchived: s.is_archived === 1,
      currentBalance: s.current_balance || 0,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  }, [rawSuppliers]);

  // Calculate live statistics
  const stats = useMemo(() => {
    const total = mappedSuppliers.length;
    const active = mappedSuppliers.filter((s) => !s.isArchived).length;
    const archived = mappedSuppliers.filter((s) => s.isArchived).length;
    return { total, active, archived };
  }, [mappedSuppliers]);

  // Filter based on whether we are displaying active or archived in the list
  const listFiltered = useMemo(() => {
    return mappedSuppliers.filter((s) => s.isArchived === showArchived);
  }, [mappedSuppliers, showArchived]);

  // Paged list
  const totalPages = Math.ceil(listFiltered.length / itemsPerPage);
  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return listFiltered.slice(start, start + itemsPerPage);
  }, [listFiltered, page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Suppliers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage vendor profiles and purchase contact directory.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-11" onClick={handleRefresh}>
            <RefreshCw className="size-4" />
          </Button>
          <Button onClick={() => setAddOpen(true)} className="h-11 rounded-xl">
            <Plus className="mr-2 size-4" /> Add supplier
          </Button>
        </div>
      </div>

      {/* Supplier Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Truck className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground font-medium">Total Suppliers</div>
          </div>
        </div>
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 grid place-items-center"><Star className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.active}</div>
            <div className="text-[10px] text-muted-foreground font-medium">Active Suppliers</div>
          </div>
        </div>
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center"><Archive className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.archived}</div>
            <div className="text-[10px] text-muted-foreground font-medium">Archived Suppliers</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card-soft p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, or GSTIN..."
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <div className="flex gap-2 min-w-[200px]">
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
            <SelectTrigger className="h-11 rounded-xl">
              <ArrowUpDown className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showArchived ? "default" : "outline"}
            className="h-11 rounded-xl px-4"
            onClick={() => { setShowArchived(!showArchived); setPage(1); }}
          >
            <Archive className="mr-2 size-4" /> {showArchived ? "Viewing Archived" : "View Archived"}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="text-sm font-semibold text-foreground">Suppliers could not be loaded</div>
          <div className="max-w-md text-xs text-muted-foreground">The backend database is not responding. Please retry.</div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 size-4" /> Retry
          </Button>
        </div>
      ) : paginatedSuppliers.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-5" />}
          title={showArchived ? "No archived suppliers" : "No suppliers found"}
          description="Try searching with another name or GSTIN."
          action={!showArchived ? <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 size-4" /> Add supplier</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {paginatedSuppliers.map((s) => {
              const open = openId === s.id;
              return (
                <div key={s.id} className="card-soft animate-fade-in">
                  <button
                    onClick={() => setOpenId(open ? null : s.id)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <div className="grid size-11 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {s.name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold text-foreground">{s.name}</div>
                        {s.gstin && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                            GSTIN: {s.gstin}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {s.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="size-3" /> {s.phone}
                          </span>
                        )}
                        {s.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" /> {s.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 mr-2">
                      <div className="text-[9px] text-muted-foreground uppercase font-semibold">Balance Due</div>
                      <div className={`font-bold tabular-nums text-sm ${s.currentBalance > 0 ? "text-rose-500" : s.currentBalance < 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {inr(s.currentBalance)}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
                    />
                  </button>

                  {open && (
                    <SupplierDetail
                      supplier={s}
                      onEdit={() => setEditTarget(s as any)}
                      onArchive={() => setArchiveTarget(s as any)}
                      onPay={() => setPaymentTarget(s)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({listFiltered.length} suppliers)
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

      <SupplierDialog open={addOpen} onOpenChange={setAddOpen} mode="add" onSaved={handleRefresh} />
      <SupplierDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        mode="edit"
        supplier={editTarget as any}
        onSaved={handleRefresh}
      />

      {/* Record Payment Dialog */}
      <Dialog open={paymentTarget !== null} onOpenChange={(v) => !v && setPaymentTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment: {paymentTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Outstanding Balance</label>
              <div className="text-lg font-bold text-rose-500 tabular-nums">
                {paymentTarget && inr(paymentTarget.currentBalance)}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Amount (₹)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
                className="h-11 rounded-xl text-lg font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Method</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Reference Number</label>
              <Input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. Transaction ID, Check Num"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Date</label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Notes</label>
              <Input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Payment memo / notes..."
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl h-11" onClick={() => setPaymentTarget(null)}>Cancel</Button>
            <Button className="rounded-xl h-11" onClick={handleRecordPayment} disabled={isSubmittingPayment}>
              {isSubmittingPayment ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={(v) => !v && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive supplier {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the supplier profile. They will be removed from your active supplier directory and list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={async () => {
                if (archiveTarget) {
                  try {
                    await deleteSupplierApi(archiveTarget.id);
                    toast.success(`Supplier "${archiveTarget.name}" archived successfully`);
                    handleRefresh();
                  } catch (e) {
                    toast.error("Failed to archive supplier");
                  }
                }
                setArchiveTarget(null);
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SupplierDetail({
  supplier,
  onEdit,
  onArchive,
  onPay,
}: {
  supplier: ExtendedSupplier;
  onEdit: () => void;
  onArchive: () => void;
  onPay: () => void;
}) {
  const registeredDate = useMemo(() => {
    if (!supplier.createdAt) return "Recently";
    try {
      return new Date(supplier.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
    } catch {
      return "Recently";
    }
  }, [supplier.createdAt]);

  // Load supplier ledger to calculate total purchases, payments, and show recent logs
  const { data: ledger = [], isLoading: isLoadingLedger } = useQuery({
    queryKey: ["supplier-ledger-drawer", supplier.id],
    queryFn: () => getSupplierLedger(supplier.id),
  });

  const summary = useMemo(() => {
    const purchases = ledger
      .filter((l: any) => l.transaction_type === "PURCHASE")
      .reduce((acc, x) => acc + x.amount, 0);
    const payments = ledger
      .filter((l: any) => l.transaction_type === "PAYMENT")
      .reduce((acc, x) => acc + x.amount, 0);
    const cancellations = ledger
      .filter((l: any) => l.transaction_type === "PURCHASE_CANCEL")
      .reduce((acc, x) => acc + x.amount, 0);

    // net purchases volume subtracts cancelled amounts
    return {
      totalPurchases: purchases - cancellations,
      totalPayments: payments,
    };
  }, [ledger]);

  const recentLogs = useMemo(() => {
    // Show last 5 ledger logs descending
    return [...ledger].reverse().slice(0, 5);
  }, [ledger]);

  const formatLocalDate = (isoStr: string) => {
    if (!isoStr) return "-";
    try {
      return new Date(isoStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        timeZone: "Asia/Kolkata",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="border-t border-border bg-muted/20 p-5 animate-fade-in space-y-6">
      {/* 1. Contact / General Info Grid */}
      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
        {supplier.gstin && (
          <div className="flex items-start gap-2">
            <Hash className="size-4 text-foreground mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-foreground">GSTIN</div>
              <div>{supplier.gstin}</div>
            </div>
          </div>
        )}
        {supplier.email && (
          <div className="flex items-start gap-2">
            <Mail className="size-4 text-foreground mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-foreground">Email Address</div>
              <div>{supplier.email}</div>
            </div>
          </div>
        )}
        {supplier.address && (
          <div className="flex items-start gap-2 col-span-full">
            <MapPin className="size-4 text-foreground mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-foreground">Address</div>
              <div>{supplier.address}</div>
            </div>
          </div>
        )}
        {supplier.notes && (
          <div className="flex items-start gap-2 col-span-full border-t border-border/40 pt-3">
            <div>
              <div className="font-semibold text-foreground">Notes / Payment Terms</div>
              <div className="mt-1 whitespace-pre-line leading-relaxed">{supplier.notes}</div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Financial Summary Block */}
      <div className="border-t border-border/40 pt-4 space-y-3">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Financial Profile</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-background border rounded-xl p-3.5 shadow-sm text-center">
            <div className="text-[9px] font-bold text-muted-foreground uppercase leading-none">Outstanding Balance</div>
            <div className={`mt-2 text-base font-extrabold tabular ${supplier.currentBalance > 0 ? "text-rose-500" : supplier.currentBalance < 0 ? "text-emerald-500" : "text-foreground"}`}>
              {inr(supplier.currentBalance)}
            </div>
          </div>
          <div className="bg-background border rounded-xl p-3.5 shadow-sm text-center">
            <div className="text-[9px] font-bold text-muted-foreground uppercase leading-none">Total Purchases</div>
            <div className="mt-2 text-base font-bold text-foreground tabular">
              {inr(summary.totalPurchases)}
            </div>
          </div>
          <div className="bg-background border rounded-xl p-3.5 shadow-sm text-center">
            <div className="text-[9px] font-bold text-muted-foreground uppercase leading-none">Total Paid</div>
            <div className="mt-2 text-base font-bold text-foreground tabular">
              {inr(summary.totalPayments)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Nested Recent Transactions statement list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Recent Ledger Logs</h4>
          <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs">
            <Link to="/supplier-ledger/$supplierId" params={{ supplierId: supplier.id }}>Full Statement →</Link>
          </Button>
        </div>

        {isLoadingLedger ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : recentLogs.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-xl bg-background/40">
            No ledger transactions recorded yet.
          </div>
        ) : (
          <div className="border border-border/40 rounded-xl bg-background/50 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40 text-[9px] uppercase font-bold text-muted-foreground">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {recentLogs.map((log: any) => {
                  const isDebit = log.transaction_type === "PAYMENT" || log.transaction_type === "PURCHASE_CANCEL";
                  const isCredit = log.transaction_type === "PURCHASE";

                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatLocalDate(log.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          log.transaction_type === "PURCHASE" ? "bg-rose-500/10 text-rose-500"
                          : log.transaction_type === "PAYMENT" ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                        }`}>
                          {log.transaction_type === "PURCHASE" ? "Purchase" : log.transaction_type === "PAYMENT" ? "Payment" : "Cancelled"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-foreground font-medium">{log.reference}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {isDebit ? inr(log.amount) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-rose-600 dark:text-rose-400 tabular-nums">
                        {isCredit ? inr(log.amount) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground tabular-nums">
                        {inr(log.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Action Panel */}
      <div className="flex items-center justify-between border-t border-border/40 pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="size-4 text-muted-foreground" />
          <span>Registered since <span className="font-medium text-foreground">{registeredDate}</span>.</span>
        </div>
        <div className="flex gap-2">
          {!supplier.isArchived && (
            <Button size="sm" className="h-8 rounded-lg" onClick={onPay}>
              <Landmark className="mr-1 size-3" /> Record Payment
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={onEdit}>
            <Pencil className="mr-1 size-3" /> Edit
          </Button>
          {!supplier.isArchived && (
            <Button size="sm" variant="outline" className="h-8 rounded-lg text-rose-500 hover:text-rose-500 hover:bg-rose-500/5 border-rose-500/20" onClick={onArchive}>
              <Trash2 className="mr-1 size-3" /> Archive
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Utility styling classes helper
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
