import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ScanBarcode, Search, X, Plus, Minus, Trash2, User, ArrowRight, CheckCircle2, Loader2, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cartTotals, useApp, type Payment } from "@/lib/store";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ParkedSalesPopover } from "@/components/parked-sales";
import { getProducts, getCustomers, searchProducts, searchCustomers, checkout as checkoutApi, getSaleReceipt, printSaleReceipt, getWhatsAppShareLink, downloadSalePdf, getSalePublicLink } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing · Orion POS" },
      { name: "description", content: "Sub-12s checkout — scan, add, take payment, print, and queue WhatsApp receipts." },
      { property: "og:title", content: "Billing · Orion POS" },
      { property: "og:description", content: "Blazing-fast, offline-first point-of-sale checkout." },
    ],
  }),
  component: Billing,
});

const payments: { label: Payment; hint: string }[] = [
  { label: "Cash", hint: "Drawer" },
  { label: "UPI", hint: "Scan QR" },
  { label: "Card", hint: "POS terminal" },
  { label: "Wallet", hint: "Store credit" },
];

const CHECKOUT_STEPS = [
  "Validating stock",
  "Creating local SQLite entry",
  "Generating invoice",
  "Preparing thermal print",
  "Queueing WhatsApp receipt",
] as const;

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card-soft flex flex-col p-4 text-left border border-border">
          <Skeleton className="size-12 rounded-xl" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-1 h-3 w-1/2" />
          <div className="mt-3 flex justify-between items-center">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Billing() {
  const queryClient = useQueryClient();
  const products = useApp((s) => s.products);
  const setProducts = useApp((s) => s.setProducts);
  const setCustomers = useApp((s) => s.setCustomers);
  const customers = useApp((s) => s.customers);
  const cart = useApp((s) => s.cart);
  const addToCart = useApp((s) => s.addToCart);
  const inc = useApp((s) => s.incQty);
  const dec = useApp((s) => s.decQty);
  const remove = useApp((s) => s.removeLine);
  const setLineDiscount = useApp((s) => s.setLineDiscount);
  const clearCart = useApp((s) => s.clearCart);
  const payment = useApp((s) => s.payment);
  const setPayment = useApp((s) => s.setPayment);
  const mobile = useApp((s) => s.customerMobile);
  const setMobile = useApp((s) => s.setCustomerMobile);
  const name = useApp((s) => s.customerName);
  const setName = useApp((s) => s.setCustomerName);
  const parkSale = useApp((s) => s.parkSale);

  const [q, setQ] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [step, setStep] = useState(-1);
  const [showSlip, setShowSlip] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<any>(null);

  // Customer search states
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const runSearch = async (query: string) => {
    setLoadingProducts(true);
    try {
      const data = await searchProducts(query);
      setProducts(data);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoadingProducts(false);
    }
  };

  const runCustomerSearch = async (query: string) => {
    setSearchingCustomer(true);
    try {
      const results = await searchCustomers(query);
      setCustomerSuggestions(results);
    } catch (err: any) {
      // Silently ignore search error
    } finally {
      setSearchingCustomer(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (q.trim()) {
        runSearch(q);
      } else {
        loadProducts();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (!customerQuery.trim()) {
      setCustomerSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      runCustomerSearch(customerQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  // Check if phone number exists in DB when mobile changes to 10 digits
  useEffect(() => {
    if (mobile.length === 10) {
      const found = customers.find((c) => c.mobile === mobile);
      if (found) {
        setSelectedCustomer(found);
      } else {
        fetch(`http://localhost:8080/customers/phone/${mobile}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.success && json.data) {
              const c = json.data;
              const mapped = {
                id: String(c.id),
                name: c.name,
                mobile: c.phone,
                ltv: (c.lifetime_value ?? 0) / 100,
                visits: c.total_orders ?? 0,
                lastVisit: c.last_visit ? new Date(c.last_visit).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "Never",
                since: c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Recently",
                email: c.email || undefined,
                address: c.address || undefined,
                notes: c.notes || undefined,
              };
              setSelectedCustomer(mapped);
              useApp.getState().addCustomer(mapped);
            }
          })
          .catch(() => {});
      }
    }
  }, [mobile, customers]);

  const handleCustomerQueryChange = (value: string) => {
    setCustomerQuery(value);
    setShowSuggestions(true);

    const sanitized = value.replace(/\D/g, "");
    if (sanitized.length === 10) {
      setMobile(sanitized);
    } else {
      setName(value);
    }

    if (!value) {
      setMobile("");
      setName("");
      setSelectedCustomer(null);
    }
  };

  const knownCustomer = useMemo(() => {
    if (selectedCustomer) return selectedCustomer;
    return customers.find((c) => c.mobile === mobile);
  }, [mobile, customers, selectedCustomer]);

  const totals = cartTotals(cart);

  const scan = () => {
    const inStock = products.filter((p) => p.stock > 0);
    if (inStock.length === 0) {
      toast.error("No active products with stock available to scan.");
      return;
    }
    const p = inStock[Math.floor(Math.random() * inStock.length)];
    addToCart(p);
    toast.success(`Scanned: ${p.name}`, { description: p.sku });
  };

  const runCheckout = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (mobile.length < 10) { toast.error("Enter customer mobile (10 digits)"); return; }

    try {
      setStep(0);
      await new Promise((r) => setTimeout(r, 200));

      const dto = {
        customerPhone: mobile,
        paymentMethod: payment,
        cashierName: "Admin",
        items: cart.map((l) => ({
          productId: Number(l.productId),
          quantity: l.qty,
        })),
        customerName: name || "Walk-in Customer",
      };

      setStep(1);
      const res = await checkoutApi(dto);

      setStep(2);
      await new Promise((r) => setTimeout(r, 200));

      setStep(3);
      await new Promise((r) => setTimeout(r, 200));

      setStep(4);
      await new Promise((r) => setTimeout(r, 200));

      setStep(CHECKOUT_STEPS.length);
      setCheckoutResult(res);

      clearCart();
      setCustomerQuery("");
      setSelectedCustomer(null);

      // Invalidate queries to auto-refresh metrics
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-all"] });

      // Refresh local store cache
      getProducts().then(setProducts).catch(() => {});
      getCustomers().then((data) => {
        const mapped = data.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          mobile: c.phone,
          ltv: (c.lifetime_value ?? 0) / 100,
          visits: c.total_orders ?? 0,
          lastVisit: c.last_visit ? new Date(c.last_visit).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "Never",
          since: c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Recently",
          email: c.email || undefined,
          address: c.address || undefined,
          notes: c.notes || undefined,
        }));
        setCustomers(mapped);
      }).catch(() => {});

      toast.success("Sale complete", { description: `Invoice created: ${res.invoice}` });
      setShowSlip(true);
    } catch (err: any) {
      setStep(-1);
      toast.error(err.message || "Checkout failed");
    }
  };

  const finalizeSale = () => {
    setShowSlip(false);
    setStep(-1);
    setCheckoutResult(null);
    loadProducts();
  };

  const doPark = () => {
    if (cart.length === 0) { toast.error("Nothing to park"); return; }
    parkSale();
    toast.success("Sale parked", { description: "Resume anytime from Parked list." });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      {/* LEFT: catalog */}
      <div className="space-y-4">
        <div className="card-soft p-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, SKU or barcode…"
                className="h-11 rounded-xl pl-9"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Button onClick={scan} className="h-11 rounded-xl">
              <ScanBarcode className="mr-2 size-4" /> Scan barcode
            </Button>
            <ParkedSalesPopover />
          </div>
        </div>

        {loadingProducts ? (
          <ProductGridSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock === 0}
                className={cn(
                  "card-soft flex flex-col p-4 text-left transition-transform active:scale-[0.98] disabled:opacity-40",
                  "hover:border-foreground/20 hover:shadow-md",
                )}
              >
                <div className="grid size-12 place-items-center overflow-hidden rounded-xl bg-muted text-2xl">
                  {p.image ? <img src={p.image} alt="" className="size-full object-cover" /> : p.emoji}
                </div>
                <div className="mt-3 line-clamp-1 text-sm font-medium">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">{p.sku}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="tabular text-sm font-semibold text-money">{inr(p.price)}</span>
                  <span className="text-[11px] text-muted-foreground tabular">{p.stock} in stock</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: cart */}
      <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
        <div className="card-soft flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <div className="text-sm font-semibold">Current cart</div>
              <div className="text-xs text-muted-foreground">
                {cart.length} item{cart.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex gap-1">
              {cart.length > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={doPark} className="text-muted-foreground">
                    <PauseCircle className="mr-1 size-4" /> Hold
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground">
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-muted">
                  <ScanBarcode className="size-6 text-muted-foreground" />
                </div>
                <div className="mt-3 text-sm font-medium">Cart is empty</div>
                <div className="mt-1 text-xs text-muted-foreground">Scan or tap a product to begin.</div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {cart.map((l) => (
                  <li key={l.productId} className="p-4 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xl">{l.emoji}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{l.name}</div>
                            <div className="text-[11px] text-muted-foreground">{inr(l.price)} · GST {l.gst}%</div>
                          </div>
                          <button onClick={() => remove(l.productId)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-danger">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-lg border border-border">
                            <button onClick={() => dec(l.productId)} className="grid size-8 place-items-center hover:bg-muted"><Minus className="size-3.5" /></button>
                            <span className="tabular w-8 text-center text-sm font-medium">{l.qty}</span>
                            <button onClick={() => inc(l.productId)} className="grid size-8 place-items-center hover:bg-muted"><Plus className="size-3.5" /></button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">Disc</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={l.discount}
                              onChange={(e) => setLineDiscount(l.productId, Number(e.target.value) || 0)}
                              className="tabular h-7 w-12 rounded-md border border-border bg-elevated px-1.5 text-center text-xs"
                            />
                            <span className="text-[11px] text-muted-foreground">%</span>
                          </div>
                          <div className="tabular text-sm font-semibold">
                            {inr(l.price * l.qty * (1 - l.discount / 100))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-border p-4">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Customer Lookup</label>
                {knownCustomer ? (
                  <Badge variant="secondary" className="rounded-full bg-success/15 text-success-foreground">Returning Customer</Badge>
                ) : mobile.length >= 10 ? (
                  <Badge variant="secondary" className="rounded-full bg-warn/25 text-warn-foreground">New Customer</Badge>
                ) : null}
              </div>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="grid size-9 place-items-center rounded-lg bg-elevated">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                  <Input
                    placeholder="Search Name or Mobile..."
                    value={customerQuery}
                    onChange={(e) => handleCustomerQueryChange(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    className="h-10 rounded-lg text-xs sm:text-sm"
                  />
                  {searchingCustomer && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>

                {showSuggestions && customerQuery && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-elevated shadow-lg animate-in fade-in slide-in-from-top-1 duration-200">
                    {customerSuggestions.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No customer found.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {customerSuggestions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setMobile(c.phone);
                              setName(c.name);
                              setSelectedCustomer({
                                id: c.id,
                                name: c.name,
                                mobile: c.phone,
                                lifetime_value: c.lifetime_value,
                                total_orders: c.total_orders,
                                last_visit: c.last_visit,
                              });
                              setCustomerQuery(c.name);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted text-xs flex justify-between items-center transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-foreground">{c.name}</div>
                              <div className="text-[10px] text-muted-foreground">{c.phone}</div>
                            </div>
                            <div className="text-right text-[10px] text-muted-foreground">
                              <div>{c.total_orders} visits</div>
                              <div>LTV {inr(c.lifetime_value / 100)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {knownCustomer ? (
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground border-t border-border/30 pt-2 flex justify-between items-center">
                  <div>
                    <div><span className="font-medium text-foreground">{knownCustomer.name}</span></div>
                    <div>LTV {inr((knownCustomer.lifetime_value || knownCustomer.ltv * 100 || 0) / 100)} · {knownCustomer.total_orders ?? knownCustomer.visits ?? 0} visits · Last: {knownCustomer.last_visit ?? knownCustomer.lastVisit ?? "Never"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobile("");
                      setName("");
                      setCustomerQuery("");
                      setSelectedCustomer(null);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-2 border-t border-border/30 pt-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">New Customer Details</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Mobile"
                      value={mobile}
                      maxLength={10}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                      className="h-9 rounded-lg text-xs"
                    />
                    <Input
                      placeholder="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Payment method</div>
              <div className="grid grid-cols-4 gap-1.5">
                {payments.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setPayment(p.label)}
                    className={cn(
                      "rounded-xl border p-2 text-center transition-colors",
                      payment === p.label ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/30",
                    )}
                  >
                    <div className="text-xs font-semibold">{p.label}</div>
                    <div className="text-[10px] opacity-70">{p.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="tabular space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
              <Row label="Subtotal" value={inr(totals.subtotal)} />
              <Row label="Discount" value={`− ${inr(totals.discount)}`} muted />
              <Row label="GST" value={inr(totals.gst)} muted />
              <div className="my-1 border-t border-border" />
              <Row label="Grand total" value={inr(totals.total)} bold />
            </div>

            <Button onClick={runCheckout} className="h-12 w-full rounded-xl text-base font-semibold">
              Checkout <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>

      <CheckoutDialog open={step >= 0 && !showSlip} step={step} />
      <SlipDialog
        open={showSlip}
        onClose={finalizeSale}
        result={checkoutResult}
      />
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(muted && "text-muted-foreground", bold && "text-base font-semibold")}>{label}</span>
      <span className={cn(bold && "text-base font-semibold")}>{value}</span>
    </div>
  );
}

function CheckoutDialog({ open, step }: { open: boolean; step: number }) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Processing sale</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2">
          {CHECKOUT_STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors",
                  done && "border-success/30 bg-success/5",
                  active && "border-foreground/30 bg-muted/40",
                  !done && !active && "border-border opacity-60",
                )}
              >
                {done ? <CheckCircle2 className="size-4 text-success" /> :
                  active ? <Loader2 className="size-4 animate-spin text-foreground" /> :
                  <div className="size-4 rounded-full border border-border" />}
                <span className={cn(done && "text-muted-foreground line-through")}>{label}</span>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function SlipDialog({
  open, onClose, result,
}: {
  open: boolean; onClose: () => void; result: any;
}) {
  const invoiceId = result?.invoice;
  const [printing, setPrinting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: receipt, isLoading } = useQuery({
    queryKey: ["receipt", invoiceId],
    queryFn: () => getSaleReceipt(invoiceId),
    enabled: open && !!invoiceId,
  });

  const handlePrint = async () => {
    if (!receipt) return;
    setPrinting(true);
    try {
      await printSaleReceipt(receipt.invoiceNumber);
      toast.success("Receipt printed successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to print receipt");
    } finally {
      setPrinting(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!receipt || !receipt.customer.phone) return;
    try {
      const url = await getWhatsAppShareLink(receipt.invoiceNumber);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate WhatsApp share link");
    }
  };

  const handleDownloadPdf = async () => {
    if (!receipt) return;
    setDownloadingPdf(true);
    try {
      const blob = await downloadSalePdf(receipt.invoiceNumber);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${receipt.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyLink = () => {
    if (!receipt?.publicToken) {
      toast.error("No public link available for this invoice");
      return;
    }
    const link = getSalePublicLink(receipt.publicToken);
    navigator.clipboard.writeText(link).then(() => {
      toast.success("Invoice link copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  if (!result) return null;

  if (isLoading || !receipt) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center font-mono">Orion POS Receipt</DialogTitle>
        </DialogHeader>

        {/* 58mm Thermal Receipt Preview Layout */}
        <div className="mx-auto w-[280px] border border-neutral-300 bg-white p-4 font-mono text-[11px] leading-relaxed text-black shadow-inner">
          <div className="text-center">
            <div className="text-sm font-bold uppercase tracking-wider">{receipt.shop.name}</div>
            <div className="text-[9px] text-neutral-500">{receipt.shop.address}</div>
            <div className="text-[9px] text-neutral-500">PH: {receipt.shop.phone}</div>
            <div className="text-[9px] text-neutral-500">GSTIN: {receipt.shop.gstin}</div>
          </div>

          <div className="my-2 border-t border-dashed border-neutral-300" />

          <div>
            <div>INV: {receipt.invoiceNumber}</div>
            <div>DATE: {receipt.date} {receipt.time}</div>
            <div>CASHIER: {receipt.cashier}</div>
            <div>CUSTOMER: {receipt.customer.name}</div>
            {receipt.customer.phone && <div>PHONE: +91 {receipt.customer.phone}</div>}
          </div>

          <div className="my-2 border-t border-dashed border-neutral-300" />

          {/* Items Grid */}
          <div className="space-y-1">
            {receipt.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between">
                <span className="truncate pr-2">
                  {item.qty}x {item.name}
                </span>
                <span className="tabular">{inr(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="my-2 border-t border-dashed border-neutral-300" />

          {/* Summary Breakdown */}
          <div className="flex justify-between tabular">
            <span>Subtotal</span>
            <span>{inr(receipt.subtotal)}</span>
          </div>
          <div className="flex justify-between tabular text-neutral-500">
            <span>Discount</span>
            <span>− {inr(receipt.discount)}</span>
          </div>
          <div className="flex justify-between tabular text-neutral-500">
            <span>GST</span>
            <span>{inr(receipt.gst)}</span>
          </div>

          <div className="my-1 border-t border-dashed border-neutral-300" />

          <div className="flex justify-between text-sm font-bold tabular">
            <span>TOTAL</span>
            <span>{inr(receipt.grandTotal)}</span>
          </div>

          <div className="my-2 border-t border-dashed border-neutral-300" />

          <div className="text-center">Paid via {receipt.paymentMethod}</div>

          {receipt.paymentMethod === "UPI" && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <div className="rounded border border-neutral-200 bg-white p-2">
                <QRCodeSVG value={receipt.upiPayload} size={80} />
              </div>
              <div className="text-[9px] text-neutral-500">Scan to pay via UPI</div>
            </div>
          )}

          <div className="mt-3 text-center text-[10px] text-neutral-500 font-bold">
            {receipt.thankYouMessage}
          </div>
        </div>

        {/* Action buttons — Print / PDF / WhatsApp / Copy Link */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={printing || isLoading} className="rounded-xl text-xs h-9">
            {printing ? "Printing…" : "🖨️ Print"}
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf || isLoading} className="rounded-xl text-xs h-9">
            {downloadingPdf ? "Generating…" : "📄 Download PDF"}
          </Button>
          {receipt && receipt.customer.phone ? (
            <Button variant="outline" onClick={handleWhatsApp} className="rounded-xl text-xs h-9">
              💬 WhatsApp
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button variant="outline" disabled className="rounded-xl text-xs h-9 w-full">
                      💬 WhatsApp
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Customer phone number required.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button variant="outline" onClick={handleCopyLink} className="rounded-xl text-xs h-9">
            🔗 Copy Link
          </Button>
        </div>
        <Button onClick={onClose} className="h-10 w-full rounded-xl mt-1">
          ✅ New Sale
        </Button>
      </DialogContent>
    </Dialog>
  );
}
