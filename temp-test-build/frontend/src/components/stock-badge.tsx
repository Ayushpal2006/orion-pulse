import { cn } from "@/lib/utils";
import type { Product } from "@/lib/mock-data";

export function stockLevel(p: Product) {
  if (p.stock === 0) return "out" as const;
  if (p.stock <= p.reorder) return "low" as const;
  return "ok" as const;
}

export function StockBadge({ product, className }: { product: Product; className?: string }) {
  const s = stockLevel(product);
  const map = {
    ok: "bg-success/15 text-success-foreground border-success/30",
    low: "bg-warn/25 text-warn-foreground border-warn/40",
    out: "bg-danger/15 text-danger border-danger/30",
  } as const;
  const label = s === "ok" ? "Healthy" : s === "low" ? "Low stock" : "Out of stock";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular",
        map[s],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {product.stock} · {label}
    </span>
  );
}
