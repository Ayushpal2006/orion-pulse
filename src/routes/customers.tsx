import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Phone, Calendar, Sparkles, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { customers, invoices } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers · Orion POS" },
      { name: "description", content: "Customer CRM with lifetime value, visit history and full invoice timeline — sorted by mobile." },
      { property: "og:title", content: "Customers · Orion POS" },
      { property: "og:description", content: "Know every shopper's story." },
    ],
  }),
  component: Customers,
});

function Customers() {
  const [q, setQ] = useState("");
  const sorted = useMemo(
    () => [...customers].sort((a, b) => a.mobile.localeCompare(b.mobile)),
    [],
  );
  const filtered = useMemo(
    () =>
      sorted.filter(
        (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.mobile.includes(q),
      ),
    [q, sorted],
  );
  const [openId, setOpenId] = useState<string | null>(sorted[0]?.id ?? null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sorted.length} shoppers · sorted by mobile
        </p>
      </div>

      <div className="card-soft p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or mobile"
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map((c) => {
          const custInvoices = invoices.filter((i) => i.customerId === c.id);
          const open = openId === c.id;
          return (
            <div key={c.id} className="card-soft">
              <button
                onClick={() => setOpenId(open ? null : c.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="grid size-11 place-items-center rounded-full bg-muted text-sm font-semibold">
                  {c.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-semibold">{c.name}</div>
                    {c.visits > 20 && (
                      <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success-foreground">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="size-3" /> +91 {c.mobile}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="tabular text-sm font-semibold text-money">{inr(c.ltv)}</div>
                  <div className="text-[11px] text-muted-foreground">LTV</div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="tabular text-sm font-semibold">{c.visits}</div>
                  <div className="text-[11px] text-muted-foreground">Visits</div>
                </div>
                <div className="hidden text-right md:block">
                  <div className="text-sm font-medium">{c.lastVisit}</div>
                  <div className="text-[11px] text-muted-foreground">Last visit</div>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open && (
                <div className="border-t border-border bg-muted/20 p-4">
                  <div className="mb-3 grid grid-cols-3 gap-3 sm:hidden">
                    <MiniStat label="LTV" value={inr(c.ltv)} />
                    <MiniStat label="Visits" value={c.visits} />
                    <MiniStat label="Last" value={c.lastVisit} />
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 text-warn-foreground" />
                    <span>
                      Repeat since <span className="font-medium text-foreground">{c.since}</span> —{" "}
                      likely to buy accessories next.
                    </span>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">Timeline</div>
                  <ol className="mt-2 space-y-3">
                    {custInvoices.length === 0 && (
                      <li className="text-sm text-muted-foreground">No purchases yet.</li>
                    )}
                    {custInvoices.map((inv) => (
                      <li key={inv.id} className="flex gap-3">
                        <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-elevated border border-border">
                          <Calendar className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 rounded-xl border border-border bg-elevated p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{inv.id}</div>
                            <div className="tabular text-sm font-semibold">{inr(inv.total)}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {inv.date} · {inv.payment}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {inv.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-elevated p-2 text-center">
      <div className="tabular text-sm font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
