import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, Phone, Calendar, Sparkles, ChevronDown, Plus, Pencil, Trash2, ExternalLink, Printer, FileText, Loader2, Users, Award, RefreshCw, Star
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
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CustomerDialog } from "@/components/customer-dialog";
import { EmptyState } from "@/components/empty-state";
import type { Customer } from "@/lib/mock-data";
import { formatToKolkataDateTime, formatToKolkataDate, parseDbTimestamp } from "@/lib/datetime";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCustomers, searchCustomers, deleteCustomerApi, getCustomerInvoices, getWhatsAppShareLink, getSalePublicLink, API_BASE_URL } from "@/lib/api";

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
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
    }, 300);
    return () => clearTimeout(handler);
  }, [q]);

  // Load all customers for stats computation
  const { data: allCustomers = [], refetch: refetchAll } = useQuery({
    queryKey: ["customers-all"],
    queryFn: getCustomers,
  });

  // Query customers using debounced query filter
  const { data: filtered = [], isLoading, isError, refetch: refetchFiltered } = useQuery({
    queryKey: ["customers", debouncedQ],
    queryFn: () => debouncedQ ? searchCustomers(debouncedQ) : getCustomers(),
  });

  const [openId, setOpenId] = useState<string | null>(null);

  // Auto-refresh lists helper
  const handleRefresh = () => {
    refetchAll();
    refetchFiltered();
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customers-all"] });
  };

  // Convert backend Customer object schema to frontend Customer object schema
  const mappedFiltered: Customer[] = useMemo(() => {
    return filtered.map((c: any) => ({
      id: String(c.id),
      name: c.name,
      mobile: c.phone,
      ltv: (c.lifetime_value ?? 0) / 100, // paise to INR
      visits: c.total_orders ?? 0,
      lastVisit: c.last_visit ? formatToKolkataDate(c.last_visit) : "Never",
      since: c.created_at ? parseDbTimestamp(c.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Recently",
      email: c.email || undefined,
      address: c.address || undefined,
      notes: c.notes || undefined,
    }));
  }, [filtered]);

  // Compute live statistics cards from all database customer records
  const stats = useMemo(() => {
    const total = allCustomers.length;
    const vip = allCustomers.filter((c: any) => (c.lifetime_value ?? 0) >= 500000).length; // Spends > INR 5,000
    const returning = allCustomers.filter((c: any) => (c.total_orders ?? 0) > 1).length;
    
    const todayStr = new Date().toISOString().substring(0, 10);
    const newToday = allCustomers.filter((c: any) => c.created_at && c.created_at.substring(0, 10) === todayStr).length;

    return { total, vip, returning, newToday };
  }, [allCustomers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRM database linked directly to checkout engine.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-11" onClick={handleRefresh}>
            <RefreshCw className="size-4" />
          </Button>
          <Button onClick={() => setAddOpen(true)} className="h-11 rounded-xl">
            <Plus className="mr-2 size-4" /> Add customer
          </Button>
        </div>
      </div>

      {/* CRM Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Users className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground font-medium">Total Customers</div>
          </div>
        </div>
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 grid place-items-center"><Star className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.vip}</div>
            <div className="text-[10px] text-muted-foreground font-medium">VIP Shoppers</div>
          </div>
        </div>
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-purple-500/10 text-purple-500 grid place-items-center"><Award className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.returning}</div>
            <div className="text-[10px] text-muted-foreground font-medium">Returning Buyers</div>
          </div>
        </div>
        <div className="card-soft p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center"><Calendar className="size-5" /></div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{stats.newToday}</div>
            <div className="text-[10px] text-muted-foreground font-medium">Acquired Today</div>
          </div>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, or invoice number..."
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="text-sm font-semibold text-foreground">Customers could not be loaded</div>
          <div className="max-w-md text-xs text-muted-foreground">The backend database is not responding. Please retry.</div>
          <Button variant="outline" size="sm" onClick={() => refetchFiltered()}>
            <RefreshCw className="mr-2 size-4" /> Retry
          </Button>
        </div>
      ) : mappedFiltered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="No customers found"
          description="Try searching with another name or mobile phone number."
          action={<Button onClick={() => setAddOpen(true)}><Plus className="mr-2 size-4" /> Add customer</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {mappedFiltered.map((c) => {
            const open = openId === c.id;
            return (
              <div key={c.id} className="card-soft animate-fade-in">
                <button
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="grid size-11 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {c.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-semibold text-foreground">{c.name}</div>
                      {c.visits > 10 && (
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
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
                    <div className="text-[11px] text-muted-foreground">Lifetime Spend</div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="tabular text-sm font-semibold">{c.visits}</div>
                    <div className="text-[11px] text-muted-foreground">Total Purchases</div>
                  </div>
                  <div className="hidden text-right md:block">
                    <div className="text-sm font-medium">{c.lastVisit}</div>
                    <div className="text-[11px] text-muted-foreground">Last Purchase</div>
                  </div>
                  <ChevronDown
                    className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
                  />
                </button>

                {open && (
                  <CustomerDetail
                    customer={c}
                    onEdit={() => setEditTarget(c)}
                    onDelete={() => setDeleteTarget(c)}
                    onSaved={handleRefresh}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <CustomerDialog open={addOpen} onOpenChange={setAddOpen} mode="add" onSaved={handleRefresh} />
      <CustomerDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        mode="edit"
        customer={editTarget}
        onSaved={handleRefresh}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete the customer profile from lists, but keep their past billing record ledger logs intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={async () => {
                if (deleteTarget) {
                  try {
                    await deleteCustomerApi(deleteTarget.id);
                    toast.success(`${deleteTarget.name} deleted successfully`);
                    handleRefresh();
                  } catch (e) {
                    toast.error("Failed to delete customer");
                  }
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CustomerDetail({
  customer,
  onEdit,
  onDelete,
  onSaved,
}: {
  customer: Customer;
  onEdit: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["customer-invoices", customer.id],
    queryFn: () => getCustomerInvoices(customer.id),
  });

  const handleWhatsApp = async (invoiceNumber: string) => {
    try {
      const url = await getWhatsAppShareLink(invoiceNumber);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to generate WhatsApp share link");
    }
  };



  return (
    <div className="border-t border-border bg-muted/20 p-4 animate-fade-in">
      <div className="mb-3 grid grid-cols-3 gap-3 sm:hidden">
        <MiniStat label="Lifetime Spend" value={inr(customer.ltv)} />
        <MiniStat label="Total Purchases" value={customer.visits} />
        <MiniStat label="Last Purchase" value={customer.lastVisit} />
      </div>
      {(customer.email || customer.address || customer.notes) && (
        <div className="mb-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3 border-b border-border/40 pb-3">
          {customer.email && <div><span className="font-semibold text-foreground">Email:</span> {customer.email}</div>}
          {customer.address && <div><span className="font-semibold text-foreground">Address:</span> {customer.address}</div>}
          {customer.notes && <div><span className="font-semibold text-foreground">Notes:</span> {customer.notes}</div>}
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-warn-foreground" />
          <span>
            Registered since <span className="font-medium text-foreground">{customer.since}</span>.
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={onEdit}>
            <Pencil className="mr-1 size-3" /> Edit
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-rose-500 hover:text-rose-500 hover:bg-rose-500/5 border-rose-500/20" onClick={onDelete}>
            <Trash2 className="mr-1 size-3" /> Delete
          </Button>
        </div>
      </div>

      <div className="text-xs font-semibold text-muted-foreground mb-3 mt-4">Transaction History Timeline</div>
      {isLoading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : sales.length === 0 ? (
        <div className="text-xs text-muted-foreground p-2 border border-dashed border-border rounded-xl text-center">
          No transactions billed to this account yet.
        </div>
      ) : (
        <ol className="space-y-3">
          {sales.map((sale: any) => (
            <li key={sale.id} className="flex gap-3">
              <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-elevated border border-border">
                <Calendar className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 rounded-xl border border-border bg-elevated p-3 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">{sale.invoice_number}</div>
                  <div className="tabular text-sm font-bold text-foreground">{inr((sale.grand_total ?? 0) / 100)}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatToKolkataDateTime(sale.created_at)} · {sale.payment_method}
                </div>
                <div className="pt-1 flex flex-wrap gap-1.5 border-t border-border/40">
                  {sale.public_token && (
                    <a
                      href={getSalePublicLink(sale.public_token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3" /> View HTML
                    </a>
                  )}
                  <Button
                    variant="outline"
                    className="h-7 rounded-lg text-[11px] px-2.5"
                    onClick={() => handleWhatsApp(sale.invoice_number)}
                  >
                    💬 WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="h-7 rounded-lg text-[11px] px-2.5"
                    onClick={() => window.open(`${API_BASE_URL}/sales/${sale.invoice_number}/pdf`, "_blank")}
                  >
                    <FileText className="size-3 mr-1" /> PDF Slip
                  </Button>
                  <Button
                    variant="outline"
                    className="h-7 rounded-lg text-[11px] px-2.5"
                    onClick={() => window.open(`/print/invoice/${sale.invoice_number}?autoprint=true`, "_blank")}
                  >
                    <Printer className="size-3 mr-1" /> Print Slip
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-elevated p-2 text-center border border-border/30">
      <div className="tabular text-sm font-semibold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium">{label}</div>
    </div>
  );
}
