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
  const accentBg =
    accent === "money"
      ? "bg-success/10 text-success-foreground"
      : accent === "warn"
      ? "bg-warn/20 text-warn-foreground"
      : accent === "danger"
      ? "bg-danger/10 text-danger"
      : "bg-muted text-muted-foreground";
  return (
    <div className="card-soft p-5 hover:border-foreground/15 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && (
          <div className={cn("grid size-9 place-items-center rounded-xl transition-transform hover:scale-105", accentBg)}>{icon}</div>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="tabular text-3xl font-bold tracking-tight text-foreground">{value}</div>
        {typeof delta === "number" && (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-xs",
              up ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
            )}
          >
            {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {up ? "+" : ""}
            {delta}%
          </div>
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground font-medium">{hint}</div>}
    </div>
  );
}
