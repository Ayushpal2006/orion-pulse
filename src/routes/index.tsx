import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";
import {
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Package,
  Sparkles,
  Plus,
  Truck,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { insights, salesSeries, invoices, products } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const [range, setRange] = useState<Range>("Week");
  const data = salesSeries[range];
  const lowStock = useMemo(() => products.filter((p) => p.stock <= p.reorder).length, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good morning, Aditi 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's what's happening at your store today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/billing">
              <Plus className="mr-1.5 size-4" /> New sale
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/inventory">
              <Package className="mr-1.5 size-4" /> Add product
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl">
            <Truck className="mr-1.5 size-4" /> Purchase stock
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <MetricCard
          label="Revenue Today"
          value={inr(48720)}
          delta={12}
          hint="vs yesterday"
          accent="money"
          icon={<IndianRupee className="size-4" />}
        />
        <MetricCard
          label="Orders"
          value="34"
          delta={8}
          hint={`Avg ticket ${inr(1432)}`}
          accent="default"
          icon={<ShoppingBag className="size-4" />}
        />
        <MetricCard
          label="Profit"
          value={inr(14210)}
          delta={-3}
          hint="Margin 29.2%"
          accent="money"
          icon={<TrendingUp className="size-4" />}
        />
        <MetricCard
          label="Inventory"
          value={`${products.length}`}
          hint={
            <span
              className={cn(
                lowStock ? "text-warn-foreground" : "text-muted-foreground",
                "font-medium",
              )}
            >
              {lowStock} items need restock
            </span>
          }
          accent={lowStock ? "warn" : "default"}
          icon={<Package className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Sales trend</div>
              <div className="text-xs text-muted-foreground">Live from local ledger</div>
            </div>
            <div className="flex rounded-xl border border-border bg-muted/40 p-1">
              {ranges.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    range === r
                      ? "bg-elevated text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
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
                  contentStyle={{
                    background: "var(--color-elevated)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={((v: unknown) => [inr(Number(v)), "Sales"]) as never}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-success)"
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

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
          <ul className="mt-4 space-y-3">
            {insights.map((i, idx) => (
              <li
                key={idx}
                className={cn(
                  "rounded-xl border p-3 text-sm leading-snug",
                  i.tone === "growth"
                    ? "border-success/25 bg-success/5"
                    : i.tone === "warn"
                    ? "border-warn/40 bg-warn/10"
                    : "border-border bg-muted/40",
                )}
              >
                {i.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card-soft">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <div className="text-sm font-semibold">Recent invoices</div>
            <div className="text-xs text-muted-foreground">Last 5 transactions</div>
          </div>
          <Link to="/reports" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-muted text-xs font-medium">
                  {inv.payment[0]}
                </div>
                <div>
                  <div className="font-medium">{inv.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.date} · {inv.lines.length} item{inv.lines.length > 1 ? "s" : ""}
                  </div>
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
    </div>
  );
}
