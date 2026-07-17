import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FileText, FileSpreadsheet, CalendarIcon, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { useCan } from "@/components/role-gate";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { getReportsData, API_BASE_URL } from "@/lib/api";
import { InvoiceHistory } from "@/components/invoice-history";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Orion POS" },
      { name: "description", content: "Daily & monthly sales, profit analysis and GST-ready reports — export to PDF or Excel." },
      { property: "og:title", content: "Reports · Orion POS" },
      { property: "og:description", content: "Instant, offline reporting for growing retail." },
    ],
  }),
  component: Reports,
});

type Filter =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "thisYear", label: "This year" },
];

function Reports() {
  const canProfit = useCan(["Admin", "Manager"]);
  const [filter, setFilter] = useState<Filter>("last7");
  const [range, setRange] = useState<DateRange | undefined>();
  const [showVoidInvoices, setShowVoidInvoices] = useState(false);

  // Smooth scroll to Invoice History if navigated from Dashboard "View More"
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("focus") === "invoice-history") {
      setTimeout(() => {
        const el = document.getElementById("invoice-history");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 300);
    }
  }, []);

  // Format dates for backend custom queries
  const startDateStr = (filter === "custom" && range?.from) ? format(range.from, "yyyy-MM-dd") : undefined;
  const endDateStr = (filter === "custom" && range?.to) ? format(range.to, "yyyy-MM-dd") : undefined;

  // Fetch reports data from SQLite
  const { data: reports, isLoading, isError, refetch } = useQuery({
    queryKey: ["reports", filter, startDateStr, endDateStr, showVoidInvoices],
    queryFn: () => getReportsData(filter, startDateStr, endDateStr, showVoidInvoices),
  });

  const handleExport = (type: "pdf" | "excel") => {
    const q = new URLSearchParams();
    q.append("filter", filter);
    if (startDateStr) q.append("startDate", startDateStr);
    if (endDateStr) q.append("endDate", endDateStr);
    if (showVoidInvoices) q.append("showVoidInvoices", "true");
    window.open(`${API_BASE_URL}/reports/${type}?${q.toString()}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
        <div className="text-sm font-semibold text-foreground">Reports could not be loaded</div>
        <div className="max-w-md text-sm text-muted-foreground">The backend could not produce the selected report. Please retry or verify the SQLite data source.</div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 size-4" /> Retry
        </Button>
      </div>
    );
  }

  const data = reports?.salesSeries || [];
  const recentInvoices = reports?.recentInvoices || [];
  const gstRows = reports?.gstSummary || [];
  const topProducts = reports?.topProducts || [];
  const topCustomers = reports?.topCustomers || [];
  const productsSummary = reports?.productsSummary || {
    totalUnitsSold: 0,
    totalRevenue: 0,
    uniqueProductsSold: 0,
  };

  const summary = reports || {
    revenue: 0,
    orders: 0,
    profit: 0,
    averageOrderValue: 0,
    lowStockCount: 0
  };

  const marginPercent = summary.revenue > 0 ? (summary.profit / summary.revenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All reports computed in real-time from active SQLite ledger.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleExport("pdf")}>
            <FileText className="mr-1.5 size-4" /> PDF Report
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleExport("excel")}>
            <FileSpreadsheet className="mr-1.5 size-4" /> Excel Sheets
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card-soft flex flex-wrap items-center gap-1.5 p-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 px-3 py-1">
          <input
            type="checkbox"
            id="show-void-invoices"
            checked={showVoidInvoices}
            onChange={(e) => setShowVoidInvoices(e.target.checked)}
            className="rounded border-border bg-surface text-primary focus:ring-primary size-4"
          />
          <label htmlFor="show-void-invoices" className="text-xs font-semibold text-muted-foreground select-none cursor-pointer">
            Show Void Invoices
          </label>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              onClick={() => setFilter("custom")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === "custom"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <CalendarIcon className="size-3.5" />
              {range?.from
                ? range.to
                  ? `${format(range.from, "d MMM")} – ${format(range.to, "d MMM")}`
                  : format(range.from, "d MMM yyyy")
                : "Custom range"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(r) => {
                setRange(r);
                setFilter("custom");
              }}
              numberOfMonths={1}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card-soft p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Revenue</span>
          <div className="text-2xl font-bold tracking-tight text-foreground">{inr(summary.revenue)}</div>
        </div>
        <div className="card-soft p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Orders Count</span>
          <div className="text-2xl font-bold tracking-tight text-foreground">{summary.orders}</div>
        </div>
        {canProfit && (
          <div className="card-soft p-4 space-y-1 border-emerald-500/20 bg-emerald-500/[0.02]">
            <span className="text-xs text-emerald-500/80 font-medium">Gross Profit ({marginPercent.toFixed(1)}%)</span>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{inr(summary.profit)}</div>
          </div>
        )}
        <div className="card-soft p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Low Stock Alerts</span>
          <div className={`text-2xl font-bold tracking-tight ${summary.lowStockCount > 0 ? "text-amber-500" : "text-foreground"}`}>
            {summary.lowStockCount} items
          </div>
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="rounded-xl">
          <TabsTrigger value="sales" className="rounded-lg">Sales</TabsTrigger>
          {canProfit && (
            <TabsTrigger value="profit" className="rounded-lg">Profit</TabsTrigger>
          )}
          <TabsTrigger value="gst" className="rounded-lg">GST</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4 space-y-4 animate-fade-in">
          <ChartCard title="Sales Trend" subtitle={FILTERS.find((f) => f.key === filter)?.label ?? "Custom range"} data={data} dataKey="value" color="var(--color-success)" />
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card-soft overflow-hidden flex flex-col justify-between">
              <div>
                <div className="border-b border-border p-4 text-sm font-semibold">Top Selling Products</div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Product</th>
                      <th className="px-4 py-3 text-right font-medium">Qty Sold</th>
                      <th className="px-4 py-3 text-right font-medium">Revenue</th>
                      <th className="px-4 py-3 text-right font-medium">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topProducts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">
                          No product sales logs found.
                        </td>
                      </tr>
                    ) : (
                      topProducts.slice(0, 5).map((p: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{p.unitsSold}</td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">{inr(p.revenue)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{inr(p.avgPrice || (p.unitsSold > 0 ? p.revenue / p.unitsSold : 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Cards */}
              <div className="border-t border-border bg-muted/20 p-4 mt-auto">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-border bg-background p-3 text-center shadow-sm">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">Total Sold</div>
                    <div className="mt-1.5 text-sm font-bold text-foreground truncate">{productsSummary.totalUnitsSold} Units</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3 text-center shadow-sm">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">Product Revenue</div>
                    <div className="mt-1.5 text-sm font-bold text-money truncate">{inr(productsSummary.totalRevenue)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3 text-center shadow-sm">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">Unique Sold</div>
                    <div className="mt-1.5 text-sm font-bold text-foreground truncate">{productsSummary.uniqueProductsSold}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-soft overflow-hidden">
              <div className="border-b border-border p-4 text-sm font-semibold">Top Spender Customers</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-right font-medium">Orders</th>
                    <th className="px-4 py-3 text-right font-medium">Total Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                        No customer spends found.
                      </td>
                    </tr>
                  ) : (
                    topCustomers.map((c: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div>{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">{c.phone}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{c.orders}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{inr(c.spend)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60">
            <div className="text-base font-bold text-foreground mb-4">Invoice History Ledger</div>
            <InvoiceHistory />
          </div>
        </TabsContent>

        {canProfit && (
          <TabsContent value="profit" className="mt-4 space-y-4 animate-fade-in">
            <ChartCard title="Profit Trend" subtitle="Selected range" data={data} dataKey="profit" color="var(--color-primary)" />
          </TabsContent>
        )}

        <TabsContent value="gst" className="mt-4 space-y-4 animate-fade-in">
          <div className="card-soft overflow-hidden">
            <div className="border-b border-border p-4 text-sm font-semibold">
              GST summary · {FILTERS.find((f) => f.key === filter)?.label ?? "Custom range"}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Slab</th>
                  <th className="px-4 py-3 text-right font-medium">Taxable value</th>
                  <th className="px-4 py-3 text-right font-medium">Tax collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gstRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No GST logs found in this period.
                    </td>
                  </tr>
                ) : (
                  gstRows.map((r: any) => (
                    <tr key={r.slab}>
                      <td className="px-4 py-3 font-medium text-foreground">GST {r.slab}%</td>
                      <td className="px-4 py-3 text-right tabular text-muted-foreground">{inr(r.taxable)}</td>
                      <td className="px-4 py-3 text-right tabular font-semibold text-foreground">{inr(r.tax)}</td>
                    </tr>
                  ))
                )}
                <tr className="bg-muted/40 font-semibold text-foreground">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular">
                    {inr(gstRows.reduce((s: number, r: any) => s + r.taxable, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {inr(gstRows.reduce((s: number, r: any) => s + r.tax, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  data,
  dataKey = "value",
  color = "var(--color-success)",
}: {
  title: string;
  subtitle: string;
  data: any[];
  dataKey?: string;
  color?: string;
}) {
  return (
    <div className="card-soft p-5 animate-fade-in">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      <div className="mt-3 h-56 flex items-center justify-center">
        {data.length === 0 ? (
          <div className="text-xs text-muted-foreground">No data coordinates to chart</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" />
              <YAxis fontSize={11} tickLine={false} axisLine={false} width={45} stroke="var(--color-muted-foreground)" />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{
                  background: "var(--color-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={((v: unknown) => [inr(Number(v)), title]) as never}
              />
              <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
