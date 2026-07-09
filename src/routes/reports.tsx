import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FileText, FileSpreadsheet, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { salesSeries, invoices } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { useCan } from "@/components/role-gate";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

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

function seriesFor(filter: Filter, range?: DateRange) {
  switch (filter) {
    case "today": return salesSeries.Today;
    case "yesterday": return salesSeries.Yesterday;
    case "last7": return salesSeries.Last7;
    case "last30": return salesSeries.Last30;
    case "thisMonth": return salesSeries.Month;
    case "lastMonth": return salesSeries.LastMonth;
    case "thisYear": return salesSeries.Year;
    case "custom": {
      if (!range?.from) return salesSeries.Last7;
      const start = range.from;
      const end = range.to ?? range.from;
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      return Array.from({ length: Math.min(30, days) }, (_, i) => ({
        label: format(new Date(start.getTime() + i * 86400000), "d MMM"),
        value: 8000 + Math.round(Math.sin(i / 2) * 5000 + i * 400),
      }));
    }
  }
}

function Reports() {
  const canProfit = useCan(["Admin", "Manager"]);
  const [filter, setFilter] = useState<Filter>("last7");
  const [range, setRange] = useState<DateRange | undefined>();

  const data = useMemo(() => seriesFor(filter, range), [filter, range]);

  const doExport = (fmt: "PDF" | "Excel") =>
    toast.success(`Export queued`, { description: `${fmt} will download when device is idle.` });

  const gstRows = [
    { slab: "5%", taxable: 42800, tax: 2140 },
    { slab: "12%", taxable: 128400, tax: 15408 },
    { slab: "18%", taxable: 96200, tax: 17316 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All data computed locally · zero cloud lag
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => doExport("PDF")}>
            <FileText className="mr-1.5 size-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => doExport("Excel")}>
            <FileSpreadsheet className="mr-1.5 size-4" /> Excel
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

      <Tabs defaultValue="sales">
        <TabsList className="rounded-xl">
          <TabsTrigger value="sales" className="rounded-lg">Sales</TabsTrigger>
          {canProfit && (
            <TabsTrigger value="profit" className="rounded-lg">Profit</TabsTrigger>
          )}
          <TabsTrigger value="gst" className="rounded-lg">GST</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4 space-y-4 animate-fade-in">
          <ChartCard title="Sales" subtitle={FILTERS.find((f) => f.key === filter)?.label ?? "Custom range"} data={data} />
          <div className="card-soft overflow-hidden">
            <div className="border-b border-border p-4 text-sm font-semibold">Recent invoices</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Payment</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 font-medium">{i.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.payment}</td>
                    <td className="px-4 py-3 text-right tabular font-semibold">{inr(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {canProfit && (
          <TabsContent value="profit" className="mt-4 space-y-4 animate-fade-in">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card-soft p-5">
                <div className="text-xs text-muted-foreground">Gross profit</div>
                <div className="tabular mt-2 text-3xl font-semibold text-money">{inr(184320)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Margin 31.4%</div>
              </div>
              <div className="card-soft p-5">
                <div className="text-xs text-muted-foreground">Best margin category</div>
                <div className="mt-2 text-2xl font-semibold">Accessories</div>
                <div className="mt-1 text-xs text-success-foreground font-medium">+38.2%</div>
              </div>
              <div className="card-soft p-5">
                <div className="text-xs text-muted-foreground">Loss leaders</div>
                <div className="mt-2 text-2xl font-semibold">2 SKUs</div>
                <div className="mt-1 text-xs text-danger">Review pricing</div>
              </div>
            </div>
            <ChartCard title="Profit trend" subtitle="Selected range" data={data} />
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
                {gstRows.map((r) => (
                  <tr key={r.slab}>
                    <td className="px-4 py-3 font-medium">GST {r.slab}</td>
                    <td className="px-4 py-3 text-right tabular">{inr(r.taxable)}</td>
                    <td className="px-4 py-3 text-right tabular font-semibold">{inr(r.tax)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular">
                    {inr(gstRows.reduce((s, r) => s + r.taxable, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {inr(gstRows.reduce((s, r) => s + r.tax, 0))}
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
}: {
  title: string;
  subtitle: string;
  data: { label: string; value: number }[];
}) {
  return (
    <div className="card-soft p-5 animate-fade-in">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" />
            <YAxis fontSize={11} tickLine={false} axisLine={false} width={40} stroke="var(--color-muted-foreground)" />
            <Tooltip
              cursor={{ fill: "var(--color-muted)" }}
              contentStyle={{
                background: "var(--color-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={((v: unknown) => [inr(Number(v)), "Value"]) as never}
            />
            <Bar dataKey="value" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
