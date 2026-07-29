import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

export function MetricCard({
  label,
  value,
  delta,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: "money" | "warn" | "danger" | "default";
}) {
  const up = (delta ?? 0) >= 0;

  const accentIconBg =
    accent === "money"
      ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
      : accent === "warn"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : accent === "danger"
      ? "bg-rose-500/12 text-rose-500"
      : "bg-muted text-muted-foreground";

  const accentBorder =
    accent === "money"
      ? "border-t-emerald-500/50"
      : accent === "warn"
      ? "border-t-amber-500/50"
      : accent === "danger"
      ? "border-t-rose-500/50"
      : "";

  return (
    <div className={cn(
      "card-soft p-5 border-t-2 hover:border-foreground/15 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
      accentBorder
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-tight">
          {label}
        </span>
        {icon && (
          <div className={cn("grid size-8 shrink-0 place-items-center rounded-xl transition-transform hover:scale-105", accentIconBg)}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="tabular text-2xl font-bold tracking-tight text-foreground leading-none">
          {value}
        </div>
        {typeof delta === "number" && (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
              up ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-500",
            )}
          >
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {up ? "+" : ""}{delta}%
          </div>
        )}
      </div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground font-medium leading-snug">{hint}</div>}
    </div>
  );
}
