import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, IndianRupee, ShoppingBag, BarChart3,
  Package, RefreshCw, Loader2, Download, Search, FileText,
  FileSpreadsheet, Filter, ChevronDown, ChevronUp, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { useCan } from "@/components/role-gate";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  getProfitSummary, getProfitProducts, getProfitTrends, getProfitReport,
  triggerProfitExport, type ProfitFilters,
} from "@/lib/api";

export const Route = createFileRoute("/profit")({
  head: () => ({
    meta: [
      { title: "Profit & Margin · Orion POS" },
      { name: "description", content: "Real-time gross profit, margin analysis, and product-level P&L using average cost method." },
    ],
  }),
  component: ProfitDashboard,
});

type FilterKey = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "thisYear", label: "This year" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(val: number) {
  return `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
}

function marginColor(m: number) {
  if (m >= 30) return "text-emerald-500";
  if (m >= 15) return "text-amber-500";
  return "text-rose-500";
}

function SortIcon({ col, sortBy, dir }: { col: string; sortBy: string; dir: "asc" | "desc" }) {
  if (sortBy !== col) return <Minus className="size-3 text-muted-foreground/40 inline ml-1" />;
  return dir === "asc"
    ? <ChevronUp className="size-3 text-primary inline ml-1" />
    : <ChevronDown className="size-3 text-primary inline ml-1" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ProfitDashboard() {
  const canExport = useCan(["Admin", "Manager"]);
  const [filter, setFilter] = useState<FilterKey>("last30");
  const [range, setRange] = useState<DateRange | undefined>();
  const [category, setCategory] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("grossProfit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const startDateStr = filter === "custom" && range?.from ? format(range.from, "yyyy-MM-dd") : undefined;
  const endDateStr = filter === "custom" && range?.to ? format(range.to, "yyyy-MM-dd") : undefined;

  const apiFilters: ProfitFilters = {
    filter,
    startDate: startDateStr,
    endDate: endDateStr,
    category: category || undefined,
  };

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["profit-summary", filter, startDateStr, endDateStr, category],
    queryFn: () => getProfitSummary(apiFilters),
    placeholderData: (prev) => prev,
  });

  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ["profit-products", filter, startDateStr, endDateStr, category],
    queryFn: () => getProfitProducts({ ...apiFilters, limit: 200 }),
    placeholderData: (prev) => prev,
  });

  const { data: trends, isLoading: trendsLoading, refetch: refetchTrends } = useQuery({
    queryKey: ["profit-trends", filter, startDateStr, endDateStr],
    queryFn: () => getProfitTrends(apiFilters),
    placeholderData: (prev) => prev,
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["profit-report", filter, startDateStr, endDateStr, category],
    queryFn: () => getProfitReport(apiFilters),
    placeholderData: (prev) => prev,
  });

  const isLoading = summaryLoading || productsLoading || trendsLoading;

  const handleRefresh = () => {
    refetchSummary();
    refetchProducts();
    refetchTrends();
  };

  // ─── Derived data ────────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let rows = [...products];
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      rows = rows.filter((p: any) =>
        p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
      );
    }
    rows.sort((a: any, b: any) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [products, productSearch, sortBy, sortDir]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p: any) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(1);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Profit & Margin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gross profit analysis using average cost method. COGS = qty × average purchase cost.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-11 rounded-xl" onClick={handleRefresh}>
            <RefreshCw className="size-4" />
          </Button>
          {canExport && (
            <>
              <Button variant="outline" size="sm" className="h-11 rounded-xl" onClick={() => { triggerProfitExport("excel", apiFilters); toast.success("Excel export started"); }}>
                <FileSpreadsheet className="mr-1.5 size-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="h-11 rounded-xl" onClick={() => { triggerProfitExport("csv", apiFilters); toast.success("CSV export started"); }}>
                <FileText className="mr-1.5 size-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="h-11 rounded-xl" onClick={() => { triggerProfitExport("pdf", apiFilters); toast.success("PDF export started"); }}>
                <Download className="mr-1.5 size-4" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="card-soft p-3 flex flex-col md:flex-row gap-3 flex-wrap">
        {/* Date filter pills */}
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
          {/* Custom date range picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  filter === "custom"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {filter === "custom" && range?.from
                  ? `${format(range.from, "dd MMM")}${range.to ? " – " + format(range.to, "dd MMM") : ""}`
                  : "Custom"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => { setRange(r); setFilter("custom"); setPage(1); }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
        {/* Category filter */}
        <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="h-9 rounded-xl w-44">
            <Filter className="mr-2 size-3.5 text-muted-foreground" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Revenue"
          value={summary ? inr(summary.revenue_INR) : "—"}
          icon={<IndianRupee className="size-5" />}
          color="text-primary"
          bg="bg-primary/10"
          loading={summaryLoading}
        />
        <KpiCard
          label="Cost of Goods Sold"
          value={summary ? inr(summary.cogs_INR) : "—"}
          sub="Avg cost × qty sold"
          icon={<Package className="size-5" />}
          color="text-amber-500"
          bg="bg-amber-500/10"
          loading={summaryLoading}
        />
        <KpiCard
          label="Gross Profit"
          value={summary ? inr(summary.grossProfit_INR) : "—"}
          sub={summary ? (summary.grossProfit >= 0 ? "▲ Profitable" : "▼ Loss") : ""}
          icon={<TrendingUp className="size-5" />}
          color={summary && summary.grossProfit < 0 ? "text-rose-500" : "text-emerald-500"}
          bg={summary && summary.grossProfit < 0 ? "bg-rose-500/10" : "bg-emerald-500/10"}
          loading={summaryLoading}
        />
        <KpiCard
          label="Gross Margin"
          value={summary ? `${summary.grossMarginPercent.toFixed(1)}%` : "—"}
          sub={summary ? `${summary.unitsSold} units · ${summary.invoiceCount} invoices` : ""}
          icon={<BarChart3 className="size-5" />}
          color={summary ? marginColor(summary.grossMarginPercent) : "text-foreground"}
          bg="bg-muted/40"
          loading={summaryLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue vs Profit trend */}
        <div className="card-soft p-5">
          <div className="text-sm font-bold text-foreground mb-1">
            {filter === "thisMonth" || filter === "today" || filter === "last7" || filter === "yesterday" ? "Daily" : "Monthly"} Revenue vs Profit
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            {FILTERS.find((f) => f.key === filter)?.label || "Custom range"}
          </div>
          {trendsLoading ? (
            <div className="h-52 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={
                  (filter === "today" || filter === "yesterday" || filter === "last7" || filter === "last30" || filter === "custom")
                    ? (trends?.daily || [])
                    : (trends?.monthly || [])
                }
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={50} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--color-elevated)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any, n: any) => [inr(Number(v)), n === "revenue" ? "Revenue" : "Gross Profit"]}
                />
                <Legend formatter={(v) => v === "revenue" ? "Revenue" : "Gross Profit"} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="grossProfit" stroke="#10b981" fill="url(#profGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top products by margin — bar chart */}
        <div className="card-soft p-5">
          <div className="text-sm font-bold text-foreground mb-1">Top 10 Products by Margin %</div>
          <div className="text-xs text-muted-foreground mb-4">Higher is better</div>
          {productsLoading ? (
            <div className="h-52 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[...products]
                  .sort((a: any, b: any) => b.grossMarginPercent - a.grossMarginPercent)
                  .slice(0, 10)
                  .map((p: any) => ({ label: p.name.substring(0, 12), margin: p.grossMarginPercent }))}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" fontSize={9} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={10} tickLine={false} axisLine={false} width={35} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "var(--color-elevated)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Margin"]}
                />
                <Bar dataKey="margin" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabs: Products | Reports */}
      <Tabs defaultValue="products">
        <TabsList className="rounded-xl">
          <TabsTrigger value="products" className="rounded-lg">Product P&L</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg">Reports</TabsTrigger>
        </TabsList>

        {/* ── Product P&L Table ── */}
        <TabsContent value="products" className="mt-4 space-y-3 animate-fade-in">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setPage(1); }}
                placeholder="Search product or category..."
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <div className="text-xs text-muted-foreground self-center">
              {filteredProducts.length} products
            </div>
          </div>

          {productsLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card-soft p-12 text-center text-sm text-muted-foreground">
              No product profit data found for this period.
            </div>
          ) : (
            <>
              <div className="card-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground">
                        <th className="p-4">Product</th>
                        <th className="p-4 cursor-pointer hover:text-foreground" onClick={() => toggleSort("unitsSold")}>
                          Units <SortIcon col="unitsSold" sortBy={sortBy} dir={sortDir} />
                        </th>
                        <th className="p-4 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort("revenue")}>
                          Revenue <SortIcon col="revenue" sortBy={sortBy} dir={sortDir} />
                        </th>
                        <th className="p-4 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort("cogs")}>
                          COGS <SortIcon col="cogs" sortBy={sortBy} dir={sortDir} />
                        </th>
                        <th className="p-4 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort("grossProfit")}>
                          Gross Profit <SortIcon col="grossProfit" sortBy={sortBy} dir={sortDir} />
                        </th>
                        <th className="p-4 text-right cursor-pointer hover:text-foreground" onClick={() => toggleSort("grossMarginPercent")}>
                          Margin % <SortIcon col="grossMarginPercent" sortBy={sortBy} dir={sortDir} />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedProducts.map((p: any) => (
                        <tr key={p.productId} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-foreground">{p.name}</div>
                            {p.category && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">{p.category}</div>
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground tabular-nums">{p.unitsSold}</td>
                          <td className="p-4 text-right tabular-nums font-medium text-foreground">{inr(p.revenue_INR)}</td>
                          <td className="p-4 text-right tabular-nums text-amber-600 dark:text-amber-400">{inr(p.cogs_INR)}</td>
                          <td className={cn(
                            "p-4 text-right tabular-nums font-bold",
                            p.grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                          )}>
                            {inr(p.grossProfit_INR)}
                          </td>
                          <td className="p-4 text-right">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                              p.grossMarginPercent >= 30 ? "bg-emerald-500/10 text-emerald-500"
                              : p.grossMarginPercent >= 15 ? "bg-amber-500/10 text-amber-500"
                              : "bg-rose-500/10 text-rose-500"
                            )}>
                              {p.grossMarginPercent.toFixed(1)}%
                            </span>
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
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Reports Tab ── */}
        <TabsContent value="reports" className="mt-4 space-y-4 animate-fade-in">
          {reportLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <ReportList title="🏆 Top Profitable Products" items={report?.topProducts || []} valueKey="grossProfit_INR" labelFn={(v: number) => inr(v)} />
              <ReportList title="📉 Least Profitable Products" items={report?.bottomProducts || []} valueKey="grossProfit_INR" labelFn={(v: number) => inr(v)} />
              <ReportList title="💎 Highest Margin Products" items={report?.highestMarginProducts || []} valueKey="grossMarginPercent" labelFn={(v: number) => `${v.toFixed(1)}%`} />
              <ReportList title="⚠️ Lowest Margin Products" items={report?.lowestMarginProducts || []} valueKey="grossMarginPercent" labelFn={(v: number) => `${v.toFixed(1)}%`} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color, bg, loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  loading?: boolean;
}) {
  return (
    <div className="card-soft p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={cn("size-9 rounded-xl grid place-items-center", bg, color)}>{icon}</div>
      </div>
      {loading ? (
        <div className="h-8 rounded-lg bg-muted/30 animate-pulse" />
      ) : (
        <>
          <div className={cn("text-2xl font-bold tracking-tight tabular-nums", color)}>{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
        </>
      )}
    </div>
  );
}

function ReportList({
  title, items, valueKey, labelFn,
}: {
  title: string;
  items: any[];
  valueKey: string;
  labelFn: (v: number) => string;
}) {
  return (
    <div className="card-soft overflow-hidden">
      <div className="border-b border-border p-4 text-sm font-bold text-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">No data for selected period.</div>
      ) : (
        <div className="divide-y divide-border">
          {items.slice(0, 8).map((item: any, idx: number) => (
            <div key={item.productId || idx} className="flex items-center justify-between p-3.5 hover:bg-muted/10">
              <div>
                <div className="font-medium text-sm text-foreground">{item.name}</div>
                {item.category && <div className="text-[10px] text-muted-foreground">{item.category}</div>}
              </div>
              <div className="font-bold text-sm tabular-nums text-foreground">{labelFn(item[valueKey])}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
