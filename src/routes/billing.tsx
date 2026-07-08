import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ScanBarcode, Search, X, Plus, Minus, Trash2, User, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cartTotals, useApp, type Payment } from "@/lib/store";
import { customers } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

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

function Billing() {
  const products = useApp((s) => s.products);
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

  const [q, setQ] = useState("");
  const [step, setStep] = useState(-1);
  const [showSlip, setShowSlip] = useState(false);

  const knownCustomer = useMemo(
    () => customers.find((c) => c.mobile === mobile),
    [mobile],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(t) ||
        p.sku.toLowerCase().includes(t) ||
        p.barcode.includes(t),
    );
  }, [q, products]);

  const totals = cartTotals(cart);

  const scan = () => {
    const inStock = products.filter((p) => p.stock > 0);
    const p = inStock[Math.floor(Math.random() * inStock.length)];
    addToCart(p);
    toast.success(`Scanned: ${p.name}`, { description: p.sku });
  };

  const runCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (mobile.length < 10) {
      toast.error("Enter customer mobile (10 digits)");
      return;
    }
    for (let i = 0; i < CHECKOUT_STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 380));
    }
    setStep(CHECKOUT_STEPS.length);
    setShowSlip(true);
  };

  const finalizeSale = () => {
    setShowSlip(false);
    setStep(-1);
    clearCart();
    toast.success("Sale complete", { description: `Invoice queued · WhatsApp sent to +91 ${mobile}` });
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
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock === 0}
              className={cn(
                "card-soft flex flex-col p-4 text-left transition-transform active:scale-[0.98] disabled:opacity-40",
                "hover:border-foreground/20 hover:shadow-md",
              )}
            >
              <div className="grid size-12 place-items-center rounded-xl bg-muted text-2xl">
                {p.emoji}
              </div>
              <div className="mt-3 line-clamp-1 text-sm font-medium">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">{p.sku}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="tabular text-sm font-semibold text-money">{inr(p.price)}</span>
                <span className="text-[11px] text-muted-foreground tabular">
                  {p.stock} in stock
                </span>
              </div>
            </button>
          ))}
        </div>
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
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground">
                Clear
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-muted">
                  <ScanBarcode className="size-6 text-muted-foreground" />
                </div>
                <div className="mt-3 text-sm font-medium">Cart is empty</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Scan or tap a product to begin.
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {cart.map((l) => (
                  <li key={l.productId} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xl">
                        {l.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{l.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {inr(l.price)} · GST {l.gst}%
                            </div>
                          </div>
                          <button
                            onClick={() => remove(l.productId)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-danger"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-lg border border-border">
                            <button
                              onClick={() => dec(l.productId)}
                              className="grid size-8 place-items-center hover:bg-muted"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="tabular w-8 text-center text-sm font-medium">
                              {l.qty}
                            </span>
                            <button
                              onClick={() => inc(l.productId)}
                              className="grid size-8 place-items-center hover:bg-muted"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">Disc</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={l.discount}
                              onChange={(e) =>
                                setLineDiscount(l.productId, Number(e.target.value) || 0)
                              }
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
                <label className="text-xs font-medium text-muted-foreground">
                  Customer mobile
                </label>
                {knownCustomer ? (
                  <Badge variant="secondary" className="rounded-full bg-success/15 text-success-foreground">
                    Returning
                  </Badge>
                ) : mobile.length >= 10 ? (
                  <Badge variant="secondary" className="rounded-full bg-warn/25 text-warn-foreground">
                    New customer
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-lg bg-elevated">
                  <User className="size-4 text-muted-foreground" />
                </div>
                <Input
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  value={mobile}
                  maxLength={10}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  className="tabular h-10 rounded-lg"
                />
              </div>
              {knownCustomer ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{knownCustomer.name}</span> · LTV{" "}
                  {inr(knownCustomer.ltv)} · {knownCustomer.visits} visits
                </div>
              ) : mobile.length >= 10 ? (
                <Input
                  placeholder="Customer name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 h-9 rounded-lg"
                />
              ) : null}
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
                      payment === p.label
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/30",
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

      <CheckoutDialog
        open={step >= 0 && !showSlip}
        step={step}
      />
      <SlipDialog
        open={showSlip}
        onClose={finalizeSale}
        totals={totals}
        payment={payment}
        mobile={mobile}
        customerName={knownCustomer?.name ?? name ?? "Walk-in"}
      />
    </div>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(muted && "text-muted-foreground", bold && "text-base font-semibold")}>
        {label}
      </span>
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
                {done ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : active ? (
                  <Loader2 className="size-4 animate-spin text-foreground" />
                ) : (
                  <div className="size-4 rounded-full border border-border" />
                )}
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
  open,
  onClose,
  totals,
  payment,
  mobile,
  customerName,
}: {
  open: boolean;
  onClose: () => void;
  totals: ReturnType<typeof cartTotals>;
  payment: Payment;
  mobile: string;
  customerName: string;
}) {
  const shop = useApp((s) => s.shopName);
  const gstin = useApp((s) => s.gstin);
  const cart = useApp((s) => s.cart);
  const invId = `INV-${Math.floor(10240 + Math.random() * 500)}`;
  const upi = `upi://pay?pa=orionpos@upi&pn=${encodeURIComponent(shop)}&am=${totals.total.toFixed(2)}&tn=${invId}&cu=INR`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thermal slip preview</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl border border-dashed border-border bg-elevated p-5 font-mono text-[12px] leading-relaxed">
          <div className="text-center">
            <div className="text-sm font-bold uppercase tracking-wider">{shop}</div>
            <div className="text-[10px] text-muted-foreground">GSTIN {gstin}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {invId} · {new Date().toLocaleString("en-IN")}
            </div>
          </div>
          <div className="my-2 border-t border-dashed border-border" />
          <div className="text-[10px] text-muted-foreground">
            {customerName} · +91 {mobile || "—"}
          </div>
          <div className="my-2 border-t border-dashed border-border" />
          <div className="space-y-1">
            {cart.map((l) => (
              <div key={l.productId} className="flex justify-between">
                <span className="truncate pr-2">
                  {l.qty}× {l.name}
                </span>
                <span className="tabular">{inr(l.price * l.qty * (1 - l.discount / 100))}</span>
              </div>
            ))}
          </div>
          <div className="my-2 border-t border-dashed border-border" />
          <div className="flex justify-between tabular">
            <span>Subtotal</span>
            <span>{inr(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between tabular text-muted-foreground">
            <span>Disc</span>
            <span>− {inr(totals.discount)}</span>
          </div>
          <div className="flex justify-between tabular text-muted-foreground">
            <span>GST</span>
            <span>{inr(totals.gst)}</span>
          </div>
          <div className="my-1 border-t border-dashed border-border" />
          <div className="flex justify-between text-sm font-bold tabular">
            <span>TOTAL</span>
            <span>{inr(totals.total)}</span>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">Paid via {payment}</div>
          {payment === "UPI" && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <div className="rounded-lg bg-white p-2">
                <QRCodeSVG value={upi} size={96} />
              </div>
              <div className="text-[10px] text-muted-foreground">Scan to pay {inr(totals.total)}</div>
            </div>
          )}
          <div className="mt-3 text-center text-[10px] text-muted-foreground">
            *** Thank you — visit again ***
          </div>
        </div>
        <Button onClick={onClose} className="h-11 rounded-xl">
          Done · New sale
        </Button>
      </DialogContent>
    </Dialog>
  );
}
