import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";
import {
  IndianRupee, ShoppingBag, TrendingUp, Package, Sparkles, Plus, Truck, AlertTriangle, Flame,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { insights, salesSeries, invoices } from "@/lib/mock-data";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stockLevel } from "@/components/stock-badge";

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

function Dashboard() {
  const products = useApp((s) => s.products);
  const [range, setRange] = useState<Range>("Week");
  const data = salesSeries[range];
  const lowStock = useMemo(() => products.filter((p) => stockLevel(p) !== "ok"), [products]);
  const topSelling = useMemo(() => [...products].sort((a, b) => b.price - a.price).slice(0, 5), [products]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good morning, Aditi 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's what's happening at your store today.</p>
        </div>
      </div>

      {/* 1. KPI cards — 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <MetricCard label="Revenue Today" value={inr(48720)} delta={12} hint="vs yesterday" accent="money" icon={<IndianRupee className="size-4" />} />
        <MetricCard label="Orders" value="34" delta={8} hint={`Avg ticket ${inr(1432)}`} accent="default" icon={<ShoppingBag className="size-4" />} />
        <MetricCard label="Profit" value={inr(14210)} delta={-3} hint="Margin 29.2%" accent="money" icon={<TrendingUp className="size-4" />} />
        <MetricCard
          label="Inventory"
          value={`${products.length}`}
          hint={<span className={cn(lowStock.length ? "text-warn-foreground" : "text-muted-foreground", "font-medium")}>{lowStock.length} items need restock</span>}
          accent={lowStock.length ? "warn" : "default"}
          icon={<Package className="size-4" />}
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
        <Button variant="outline" size="sm" className="rounded-xl">
          <Truck className="mr-1.5 size-4" /> Purchase stock
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
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
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
            <div className="text-xs text-muted-foreground">Updated 2 min ago</div>
          </div>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {insights.map((i, idx) => (
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
            <div className="text-xs text-muted-foreground">Last 5 invoices</div>
          </div>
          <Link to="/reports" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-muted text-xs font-medium">{inv.payment[0]}</div>
                <div>
                  <div className="font-medium">{inv.id}</div>
                  <div className="text-xs text-muted-foreground">{inv.date} · {inv.lines.length} item{inv.lines.length > 1 ? "s" : ""}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="tabular font-semibold">{inr(inv.total)}</div>
                <div className="text-xs text-muted-foreground">{inv.payment}</div>
              </div>
            </div>
          ))}
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
            {topSelling.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="grid size-8 place-items-center rounded-lg bg-muted text-lg">{p.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.sku}</div>
                </div>
                <div className="tabular text-sm font-semibold text-money">{inr(p.price)}</div>
              </li>
            ))}
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
                  <div className="truncate text-sm font-medium">{p.name}</div>
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
    </div>
  );
}
