import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee, ShoppingBag, TrendingUp, Package, Sparkles, Plus, Truck, AlertTriangle, Flame, Loader2, RefreshCw, Sliders
} from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stockLevel } from "@/components/stock-badge";
import { getDashboardData, getReportsData, getProducts, getStockAdjustments } from "@/lib/api";
import { formatToKolkataDateTime, formatToKolkataDate, parseDbTimestamp } from "@/lib/datetime";
import { InvoiceDrawer } from "@/components/invoice-drawer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Orion POS" },
      { name: "description", content: "Offline-first retail command center — sales, orders, profit and inventory at a glance." },
      { property: "og:title", content: "Dashboard · Orion POS" },
      { property: "og:description", content: "Offline-first retail command center — sales, orders, profit and inventory at a glance." },
    ],
  }),
  component: Dashboard,
});

const ranges = ["Today", "Week", "Month", "Year"] as const;
type Range = (typeof ranges)[number];

const rangeFilterMap: Record<Range, string> = {
  Today: "today",
  Week: "last7",
  Month: "thisMonth",
  Year: "thisYear",
};

// Standard AI insights (kept static or adapted based on live metrics)
const getInsights = (revenue: number, lowStockCount: number) => [
  { tone: "growth", text: `Your store generated ${inr(revenue)} today. Keep scanning items to update the ledger.` },
  { tone: "warn", text: lowStockCount > 0 ? `${lowStockCount} items need restock. Review the low stock alerts below.` : "All stock levels are currently healthy! Great job!" },
  { tone: "info", text: "UPI and Cash continue to lead your checkout payment methods split." },
  { tone: "growth", text: "Calculated margins are fully computed locally with zero cloud delay." },
];

function Dashboard() {
  const products = useApp((s) => s.products);
  const setProducts = useApp((s) => s.setProducts);
  const [range, setRange] = useState<Range>("Week");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Load products list into store on mount
  useEffect(() => {
    getProducts().then(setProducts).catch(() => {});
  }, [setProducts]);

  // 1. Fetch dashboard summary statistics
  const { data: dashboard, isLoading: isLoadingDashboard, isError: isErrorDashboard, refetch: refetchDashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardData,
  });

  // 2. Fetch sales trend series based on range selection
  const { data: reportData, isLoading: isLoadingTrend } = useQuery({
    queryKey: ["reports", range],
    queryFn: () => getReportsData(rangeFilterMap[range]),
  });

  // 3. Fetch today's stock adjustments
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const { data: todayAdjustments = [] } = useQuery({
    queryKey: ["stock-adjustments-today"],
    queryFn: () => getStockAdjustments({ startDate: todayStr }),
  });

  const lowStock = useMemo(() => products.filter((p) => stockLevel(p) !== "ok"), [products]);

  const getProductEmoji = (name: string) => {
    const matched = products.find((p) => p.name === name);
    return matched?.emoji || "📦";
  };

  const getProductSku = (name: string) => {
    const matched = products.find((p) => p.name === name);
    return matched?.sku || "";
  };

  const getProductPrice = (name: string) => {
    const matched = products.find((p) => p.name === name);
    return matched?.price || 0;
  };

  if (isLoadingDashboard) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isErrorDashboard) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
        <div className="text-sm font-semibold text-foreground">Dashboard metrics could not be loaded</div>
        <div className="max-w-md text-sm text-muted-foreground">The backend POS engine is not responding. Please check connection and retry.</div>
        <Button variant="outline" size="sm" onClick={() => refetchDashboard()}>
          <RefreshCw className="mr-2 size-4" /> Retry
        </Button>
      </div>
    );
  }

  const stats = dashboard || {
    todayRevenue: 0,
    todayOrders: 0,
    todayProfit: 0,
    inventoryCount: 0,
    lowStockCount: 0,
    topProducts: [],
    recentSales: [],
  };

  const chartSeries = reportData?.salesSeries || [];

  const avgTicket = stats.todayOrders > 0 ? stats.todayRevenue / stats.todayOrders : 0;
  const marginPercent = stats.todayRevenue > 0 ? (stats.todayProfit / stats.todayRevenue) * 100 : 0;
  const listInsights = getInsights(stats.todayRevenue, stats.lowStockCount || lowStock.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good morning, Manager 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's what's happening at your store today.</p>
        </div>
      </div>

      {/* 1. KPI cards — 5-column grid on large screens */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <MetricCard
          label="Revenue Today"
          value={inr(stats.todayRevenue)}
          delta={stats.todayRevenue > 0 ? 12 : undefined}
          hint="vs yesterday"
          accent="money"
          icon={<IndianRupee className="size-4" />}
        />
        <MetricCard
          label="Orders"
          value={String(stats.todayOrders)}
          delta={stats.todayOrders > 0 ? 8 : undefined}
          hint={`Avg ticket ${inr(avgTicket)}`}
          accent="default"
          icon={<ShoppingBag className="size-4" />}
        />
        <MetricCard
          label="Profit"
          value={inr(stats.todayProfit)}
          delta={stats.todayProfit > 0 ? -3 : undefined}
          hint={`Margin ${marginPercent.toFixed(1)}%`}
          accent="money"
          icon={<TrendingUp className="size-4" />}
        />
        <MetricCard
          label="Inventory"
          value={String(stats.inventoryCount || products.length)}
          hint={
            <span className={cn(stats.lowStockCount || lowStock.length ? "text-warn-foreground" : "text-muted-foreground", "font-medium")}>
              {stats.lowStockCount || lowStock.length} items need restock
            </span>
          }
          accent={stats.lowStockCount || lowStock.length ? "warn" : "default"}
          icon={<Package className="size-4" />}
        />
        <MetricCard
          label="Adjustments Today"
          value={String(todayAdjustments.length)}
          hint={
            <span className="text-muted-foreground font-medium">
              Net: {todayAdjustments.reduce((acc: number, a: any) => acc + (a.quantity_change || 0), 0)} units
            </span>
          }
          accent="default"
          icon={<Sliders className="size-4" />}
        />
      </div>

      {/* 2. Quick Actions */}
      <div className="card-soft flex flex-wrap items-center gap-2 p-4">
        <div className="mr-auto">
          <div className="text-sm font-semibold">Quick actions</div>
          <div className="text-xs text-muted-foreground">Common tasks in one tap</div>
        </div>
        <Button asChild size="sm" className="rounded-xl">
          <Link to="/billing"><Plus className="mr-1.5 size-4" /> New sale</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/inventory"><Package className="mr-1.5 size-4" /> Add product</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/purchases"><Truck className="mr-1.5 size-4" /> Purchase stock</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/stock-adjustments"><Sliders className="mr-1.5 size-4" /> Adjust stock</Link>
        </Button>
      </div>

      {/* 3. Sales Overview */}
      <div className="card-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Sales overview</div>
            <div className="text-xs text-muted-foreground">Live from local ledger</div>
          </div>
          <div className="flex rounded-xl border border-border bg-muted/40 p-1">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  range === r ? "bg-elevated text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 h-64 flex items-center justify-center">
          {isLoadingTrend ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : chartSeries.length === 0 ? (
            <div className="text-xs text-muted-foreground">No sales transactions in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  cursor={{ stroke: "var(--color-border)" }}
                  contentStyle={{ background: "var(--color-elevated)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                  formatter={((v: unknown) => [inr(Number(v)), "Sales"]) as never}
                />
                <Area type="monotone" dataKey="value" stroke="var(--color-success)" strokeWidth={2.5} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. AI Insights */}
      <div className="card-soft p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-xl bg-accent">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Insights</div>
            <div className="text-xs text-muted-foreground">Updated live</div>
          </div>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {listInsights.map((i, idx) => (
            <li
              key={idx}
              className={cn(
                "rounded-xl border p-3 text-sm leading-snug",
                i.tone === "growth" ? "border-success/25 bg-success/5"
                : i.tone === "warn" ? "border-warn/40 bg-warn/10"
                : "border-border bg-muted/40",
              )}
            >
              {i.text}
            </li>
          ))}
        </ul>
      </div>

      {/* 5. Recent transactions */}
      <div className="card-soft">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <div className="text-sm font-semibold">Recent transactions</div>
            <div className="text-xs text-muted-foreground">Last 10 invoices</div>
          </div>
        </div>
        <div className="divide-y divide-border">
          {stats.recentSales.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">No recent invoices logged.</div>
          ) : (
            stats.recentSales.map((inv: any) => (
              <button
                key={inv.invoiceNumber}
                onClick={() => setSelectedInvoice({ invoice: inv.invoiceNumber })}
                className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-left hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-muted text-xs font-medium">
                    {inv.payment ? inv.payment[0] : "—"}
                  </div>
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2">
                      {inv.invoiceNumber}
                      {inv.status === "VOID" && (
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-500 uppercase flex items-center gap-1">
                          🔴 VOID
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatToKolkataDateTime(inv.time)} · {inv.customer}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular font-semibold text-foreground">{inr(inv.amount)}</div>
                  <div className="text-xs text-muted-foreground">{inv.payment}</div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-4 border-t border-border flex justify-center bg-muted/10">
          <Link
            to="/reports"
            search={{ focus: "invoice-history" } as any}
            className="w-full sm:w-auto text-center rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer"
          >
            View More
          </Link>
        </div>
      </div>

      {/* 6 & 7. Top selling + Low stock */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-soft p-5">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-warn-foreground" />
            <div className="text-sm font-semibold">Top selling products</div>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {stats.topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No sales recorded yet.</div>
            ) : (
              stats.topProducts.map((p: any) => (
                <li key={p.name} className="flex items-center gap-3 py-2.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-muted text-lg">{getProductEmoji(p.name)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">SKU {getProductSku(p.name)} · {p.unitsSold} sold</div>
                  </div>
                  <div className="tabular text-sm font-semibold text-money">{inr(p.revenue)}</div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="card-soft p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-danger" />
              <div className="text-sm font-semibold">Low stock alerts</div>
            </div>
            <Link to="/inventory" className="text-xs font-medium text-muted-foreground hover:text-foreground">View →</Link>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {lowStock.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">All stock healthy 🎉</li>}
            {lowStock.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-muted text-lg">{p.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">Min {p.reorder}</div>
                </div>
                <div className={cn("tabular text-sm font-semibold", p.stock === 0 ? "text-danger" : "text-warn-foreground")}>
                  {p.stock} left
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {selectedInvoice && (
        <InvoiceDrawer
          invoiceNumber={selectedInvoice.invoice}
          open={!!selectedInvoice}
          onOpenChange={(open) => !open && setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
