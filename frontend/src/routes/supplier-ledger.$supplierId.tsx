import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  ChevronLeft, Loader2, Calendar, Sliders, Search, ArrowUpDown, FileText, Download, RefreshCw, Landmark, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupplierLedger, getSuppliers } from "@/lib/api";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/supplier-ledger/$supplierId")({
  head: () => ({
    meta: [
      { title: "Supplier Ledger · Orion POS" },
      { name: "description", content: "Vendor audit trail, purchase history, and running balance statements." },
    ],
  }),
  component: SupplierLedgerPage,
});

function SupplierLedgerPage() {
  const { supplierId } = Route.useParams();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [q, setQ] = useState("");

  // Fetch supplier profile details
  const { data: suppliersList = [], isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ["suppliers-all"],
    queryFn: () => getSuppliers("", "newest", true),
  });

  const supplier = useMemo(() => {
    return suppliersList.find((s: any) => String(s.id) === supplierId) || null;
  }, [suppliersList, supplierId]);

  // Fetch ledger entries
  const { data: ledger = [], isLoading: isLoadingLedger, isError, refetch } = useQuery({
    queryKey: ["supplier-ledger-page", supplierId, filterType, startDate, endDate],
    queryFn: () => getSupplierLedger(supplierId, {
      transaction_type: filterType === "all" ? undefined : filterType,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
  });

  // Client-side search filtering by reference
  const filteredLedger = useMemo(() => {
    if (!q.trim()) return ledger;
    const query = q.toLowerCase();
    return ledger.filter(
      (l: any) =>
        (l.reference && l.reference.toLowerCase().includes(query)) ||
        l.transaction_type.toLowerCase().includes(query)
    );
  }, [ledger, q]);

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
        timeZone: "Asia/Kolkata",
      });
    } catch {
      return isoStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoadingSuppliers || isLoadingLedger) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-center">
        <div className="text-sm font-semibold text-foreground">Supplier not found</div>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/suppliers"><ChevronLeft className="mr-1.5 size-4" /> Back to suppliers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 rounded-lg">
              <Link to="/suppliers"><ChevronLeft className="mr-1 size-4" /> Suppliers</Link>
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl mt-1">
            Supplier Ledger: {supplier.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transaction log statement and running balance ledger.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-11" onClick={() => refetch()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl h-11" onClick={handlePrint}>
            <Download className="mr-1.5 size-4" /> Print Statement
          </Button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block space-y-4">
        <div className="flex justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold">{supplier.name}</h1>
            {supplier.gstin && <div className="text-xs text-muted-foreground">GSTIN: {supplier.gstin}</div>}
            {supplier.phone && <div className="text-xs text-muted-foreground">Phone: {supplier.phone}</div>}
            {supplier.email && <div className="text-xs text-muted-foreground">Email: {supplier.email}</div>}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">Ledger Statement</h2>
            <div className="text-2xl font-black text-foreground mt-2">{inr(supplier.current_balance)}</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">Outstanding Balance</div>
          </div>
        </div>
      </div>

      {/* Summary KPI Block */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="card-soft p-4 space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Outstanding Balance</span>
          <div className={`text-2xl font-bold tracking-tight ${supplier.current_balance > 0 ? "text-rose-500" : supplier.current_balance < 0 ? "text-emerald-500" : "text-foreground"}`}>
            {inr(supplier.current_balance)}
          </div>
        </div>
        <div className="card-soft p-4 space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider font-semibold">Total Purchases</span>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {inr(ledger.filter((l: any) => l.transaction_type === "PURCHASE").reduce((acc, x) => acc + x.amount, 0))}
          </div>
        </div>
        <div className="card-soft p-4 space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider font-semibold">Total Payments</span>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {inr(ledger.filter((l: any) => l.transaction_type === "PAYMENT").reduce((acc, x) => acc + x.amount, 0))}
          </div>
        </div>
        <div className="card-soft p-4 space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Statement Entries</span>
          <div className="text-2xl font-bold tracking-tight text-foreground">{ledger.length} entries</div>
        </div>
      </div>

      {/* Filters (Print Hidden) */}
      <div className="card-soft p-3 flex flex-col md:flex-row gap-3 print:hidden">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by reference code (PRCH / PMT)..."
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-11 rounded-xl w-44">
              <Sliders className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="Transaction Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="PURCHASE">Purchases</SelectItem>
              <SelectItem value="PAYMENT">Payments</SelectItem>
              <SelectItem value="PURCHASE_CANCEL">Cancellations</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">From</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 rounded-xl w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">To</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11 rounded-xl w-36"
            />
          </div>
          {(startDate || endDate) && (
            <Button variant="outline" onClick={() => { setStartDate(""); setEndDate(""); }} className="h-11 rounded-xl">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      {isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center print:hidden">
          <div className="text-sm font-semibold text-foreground">Ledger records could not be loaded</div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 size-4" /> Retry
          </Button>
        </div>
      ) : filteredLedger.length === 0 ? (
        <div className="card-soft p-12 text-center text-sm text-muted-foreground">
          No ledger transactions logged matching the filter constraints.
        </div>
      ) : (
        <div className="card-soft overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                <th className="p-4">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4">Reference</th>
                <th className="p-4 text-right">Debit (Payment)</th>
                <th className="p-4 text-right">Credit (Purchase)</th>
                <th className="p-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLedger.map((row: any) => {
                const isDebit = row.transaction_type === "PAYMENT" || row.transaction_type === "PURCHASE_CANCEL";
                const isCredit = row.transaction_type === "PURCHASE";

                return (
                  <tr key={row.id} className="hover:bg-muted/10 transition-colors print:hover:bg-transparent">
                    <td className="p-4 text-xs text-muted-foreground">{formatLocalDate(row.created_at)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        row.transaction_type === "PURCHASE" ? "bg-rose-500/10 text-rose-500"
                        : row.transaction_type === "PAYMENT" ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {row.transaction_type === "PURCHASE" ? "Purchase" : row.transaction_type === "PAYMENT" ? "Payment" : "Cancelled Purchase"}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-foreground font-medium">{row.reference}</td>
                    <td className="p-4 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {isDebit ? inr(row.amount) : "—"}
                    </td>
                    <td className="p-4 text-right font-medium tabular-nums text-rose-600 dark:text-rose-400">
                      {isCredit ? inr(row.amount) : "—"}
                    </td>
                    <td className="p-4 text-right font-bold tabular-nums text-foreground">
                      {inr(row.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
