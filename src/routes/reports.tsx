import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { salesSeries, invoices } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { useCan } from "@/components/role-gate";

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

function Reports() {
  const canProfit = useCan(["Admin", "Manager"]);

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

      <Tabs defaultValue="sales">
        <TabsList className="rounded-xl">
          <TabsTrigger value="sales" className="rounded-lg">Sales</TabsTrigger>
          {canProfit && (
            <TabsTrigger value="profit" className="rounded-lg">Profit</TabsTrigger>
          )}
          <TabsTrigger value="gst" className="rounded-lg">GST</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Daily sales" subtitle="Last 7 days" data={salesSeries.Week} />
            <ChartCard title="Monthly sales" subtitle="This year" data={salesSeries.Year} />
          </div>
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
          <TabsContent value="profit" className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card-soft p-5">
                <div className="text-xs text-muted-foreground">Gross profit (MTD)</div>
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
            <ChartCard title="Profit trend" subtitle="Last 12 months" data={salesSeries.Year} />
          </TabsContent>
        )}

        <TabsContent value="gst" className="mt-4 space-y-4">
          <div className="card-soft overflow-hidden">
            <div className="border-b border-border p-4 text-sm font-semibold">GST summary · Nov 2026</div>
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
    <div className="card-soft p-5">
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
