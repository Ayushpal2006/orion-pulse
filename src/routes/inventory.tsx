import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Plus, Search, ScanBarcode as BarcodeIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StockBadge, stockLevel } from "@/components/stock-badge";
import { RoleGate, useCan } from "@/components/role-gate";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import type { Product } from "@/lib/mock-data";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory · Orion POS" },
      { name: "description", content: "Track stock, SKUs, GST slabs and reorder thresholds — with instant barcode generation." },
      { property: "og:title", content: "Inventory · Orion POS" },
      { property: "og:description", content: "Stock, SKUs and barcodes in one place." },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const products = useApp((s) => s.products);
  const addProduct = useApp((s) => s.addProduct);
  const canEdit = useCan(["Admin", "Manager"]);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t),
    );
  }, [q, products]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} SKUs ·{" "}
            <span className="text-warn-foreground font-medium">
              {products.filter((p) => stockLevel(p) !== "ok").length} need attention
            </span>
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setAddOpen(true)} className="h-11 rounded-xl">
            <Plus className="mr-2 size-4" /> Add product
          </Button>
        )}
      </div>

      <div className="card-soft p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or SKU"
            className="h-11 rounded-xl pl-9"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="card-soft hidden overflow-hidden lg:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-left font-medium">SKU</th>
              <th className="px-4 py-3 text-left font-medium">Barcode</th>
              <th className="px-4 py-3 text-right font-medium">Purchase</th>
              <th className="px-4 py-3 text-right font-medium">Selling</th>
              <th className="px-4 py-3 text-right font-medium">GST</th>
              <th className="px-4 py-3 text-right font-medium">Stock</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-lg bg-muted text-lg">
                      {p.emoji}
                    </div>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.category}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.sku}</td>
                <td className="px-4 py-3 tabular text-xs text-muted-foreground">{p.barcode}</td>
                <td className="px-4 py-3 text-right tabular">{inr(p.purchase)}</td>
                <td className="px-4 py-3 text-right tabular font-medium text-money">
                  {inr(p.price)}
                </td>
                <td className="px-4 py-3 text-right tabular text-muted-foreground">{p.gst}%</td>
                <td className="px-4 py-3 text-right">
                  <StockBadge product={p} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBarcodeProduct(p)}
                    className="text-muted-foreground"
                  >
                    <BarcodeIcon className="mr-1.5 size-4" /> Barcode
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
        {filtered.map((p) => (
          <div key={p.id} className="card-soft p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-muted text-xl">
                {p.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.sku} · GST {p.gst}%
                </div>
              </div>
              <StockBadge product={p} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="tabular text-lg font-semibold text-money">{inr(p.price)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBarcodeProduct(p)}
                className="rounded-lg"
              >
                <BarcodeIcon className="mr-1.5 size-4" /> Barcode
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AddProductDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(p) => {
          addProduct(p);
          toast.success(`${p.name} added`, { description: `SKU ${p.sku}` });
        }}
      />
      <BarcodeDialog product={barcodeProduct} onClose={() => setBarcodeProduct(null)} />
    </div>
  );
}

function AddProductDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (p: Product) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [purchase, setPurchase] = useState("");
  const [gst, setGst] = useState("12");
  const [stock, setStock] = useState("");

  const reset = () => {
    setName("");
    setPrice("");
    setPurchase("");
    setGst("12");
    setStock("");
  };

  const submit = () => {
    if (!name || !price) {
      toast.error("Name and price are required");
      return;
    }
    const id = `p${Math.floor(Math.random() * 100000)}`;
    onAdd({
      id,
      name,
      sku: `NEW-${id.toUpperCase()}`,
      barcode: String(8900000000000 + Math.floor(Math.random() * 999999)),
      category: "General",
      purchase: Number(purchase) || 0,
      price: Number(price),
      gst: Number(gst),
      stock: Number(stock) || 0,
      reorder: 5,
      emoji: "📦",
    });
    reset();
    onOpenChange(false);
  };

  return (
    <RoleGate allow={["Admin", "Manager"]} fallback={null}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Product name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Denim Jacket" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Purchase price">
                <Input
                  inputMode="numeric"
                  value={purchase}
                  onChange={(e) => setPurchase(e.target.value)}
                  placeholder="₹"
                />
              </Field>
              <Field label="Selling price">
                <Input
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="₹"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST %">
                <Input inputMode="numeric" value={gst} onChange={(e) => setGst(e.target.value)} />
              </Field>
              <Field label="Opening stock">
                <Input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Add product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGate>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function BarcodeDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (product && svgRef.current) {
      try {
        JsBarcode(svgRef.current, product.barcode, {
          format: "EAN13",
          displayValue: true,
          fontSize: 12,
          height: 60,
          margin: 8,
          background: "#ffffff",
        });
      } catch {
        // ignore malformed
      }
    }
  }, [product]);

  return (
    <Dialog open={!!product} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Barcode · {product?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid place-items-center rounded-xl border border-border bg-white p-4">
          <svg ref={svgRef} />
        </div>
        <div className="text-center text-xs text-muted-foreground">
          {product?.sku} · GST {product?.gst}%
        </div>
        <Button
          onClick={() => {
            toast.success("Barcode sent to printer");
            onClose();
          }}
        >
          Print label
        </Button>
      </DialogContent>
    </Dialog>
  );
}
