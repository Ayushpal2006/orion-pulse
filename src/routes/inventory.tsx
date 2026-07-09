import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Plus, Search, ScanBarcode as BarcodeIcon, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StockBadge, stockLevel } from "@/components/stock-badge";
import { useCan } from "@/components/role-gate";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import type { Product } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { EditProductDialog } from "@/components/edit-product-dialog";
import { StockAdjustmentDialog } from "@/components/stock-adjustment-dialog";
import { ProductDetailsDrawer } from "@/components/product-details-drawer";
import { EmptyState } from "@/components/empty-state";

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

type StatusFilter = "all" | "ok" | "low" | "out";
type SortKey = "newest" | "name" | "price" | "stock";

const DEFAULT_CATEGORIES = ["All", "Shirts", "Jeans", "T-Shirts", "Shoes", "Accessories"];

function Inventory() {
  const products = useApp((s) => s.products);
  const duplicateProduct = useApp((s) => s.duplicateProduct);
  const deleteProduct = useApp((s) => s.deleteProduct);
  const canEdit = useCan(["Admin", "Manager"]);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const categories = useMemo(() => {
    const found = Array.from(new Set(products.map((p) => p.category)));
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...found]));
  }, [products]);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    let list = products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (status !== "all" && stockLevel(p) !== status) return false;
      if (!t) return true;
      return (
        p.name.toLowerCase().includes(t) ||
        p.sku.toLowerCase().includes(t) ||
        p.barcode.includes(t) ||
        p.category.toLowerCase().includes(t)
      );
    });
    list = [...list];
    switch (sort) {
      case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "price": list.sort((a, b) => b.price - a.price); break;
      case "stock": list.sort((a, b) => b.stock - a.stock); break;
      case "newest": list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
    }
    return list;
  }, [q, products, category, status, sort]);

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditOpen(true);
  };
  const openAdd = () => {
    setEditProduct(null);
    setAddOpen(true);
  };

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
          <Button onClick={openAdd} className="hidden h-11 rounded-xl sm:inline-flex">
            <Plus className="mr-2 size-4" /> Add product
          </Button>
        )}
      </div>

      <div className="card-soft space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, SKU, barcode or category"
            className="h-11 rounded-xl pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            {(["all", "ok", "low", "out"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  status === s ? "bg-elevated text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {s === "all" ? "All" : s === "ok" ? "Healthy" : s === "low" ? "Low" : "Out"}
              </button>
            ))}
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-[150px] rounded-lg">
              <ArrowUpDown className="mr-1 size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="price">Price (high–low)</SelectItem>
              <SelectItem value="stock">Stock (high–low)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="No products match"
          description="Try clearing search, category or status filters."
        />
      ) : (
        <>
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
                  <tr
                    key={p.id}
                    onClick={() => setDrawerProduct(p)}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 place-items-center overflow-hidden rounded-lg bg-muted text-lg">
                          {p.image ? <img src={p.image} className="size-full object-cover" alt="" /> : p.emoji}
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
                    <td className="px-4 py-3 text-right tabular font-medium text-money">{inr(p.price)}</td>
                    <td className="px-4 py-3 text-right tabular text-muted-foreground">{p.gst}%</td>
                    <td className="px-4 py-3 text-right"><StockBadge product={p} /></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => setBarcodeProduct(p)} className="text-muted-foreground">
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
              <button
                key={p.id}
                onClick={() => setDrawerProduct(p)}
                className="card-soft p-4 text-left transition-transform active:scale-[0.99] hover:border-foreground/20"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-11 place-items-center overflow-hidden rounded-xl bg-muted text-xl">
                    {p.image ? <img src={p.image} className="size-full object-cover" alt="" /> : p.emoji}
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
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Sticky mobile Add FAB */}
      {canEdit && (
        <button
          onClick={openAdd}
          className="fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full bg-foreground text-background shadow-lg transition-transform active:scale-95 sm:hidden"
          aria-label="Add product"
        >
          <Plus className="size-6" />
        </button>
      )}

      <EditProductDialog open={addOpen} onOpenChange={setAddOpen} product={null} mode="add" />
      <EditProductDialog open={editOpen} onOpenChange={setEditOpen} product={editProduct} mode="edit" />
      <StockAdjustmentDialog
        open={!!adjustProduct}
        onOpenChange={(v) => !v && setAdjustProduct(null)}
        product={adjustProduct}
      />
      <BarcodeDialog product={barcodeProduct} onClose={() => setBarcodeProduct(null)} />

      <ProductDetailsDrawer
        product={drawerProduct}
        open={!!drawerProduct}
        onOpenChange={(v) => !v && setDrawerProduct(null)}
        onEdit={() => {
          if (drawerProduct) openEdit(drawerProduct);
          setDrawerProduct(null);
        }}
        onAdjust={() => {
          setAdjustProduct(drawerProduct);
          setDrawerProduct(null);
        }}
        onBarcode={() => {
          setBarcodeProduct(drawerProduct);
          setDrawerProduct(null);
        }}
        onDuplicate={() => {
          if (drawerProduct) {
            duplicateProduct(drawerProduct.id);
            toast.success(`${drawerProduct.name} duplicated`);
          }
          setDrawerProduct(null);
        }}
        onDelete={() => {
          setDeleteTarget(drawerProduct);
          setDrawerProduct(null);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This product will be removed from your inventory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteProduct(deleteTarget.id);
                  toast.success(`${deleteTarget.name} deleted`);
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
