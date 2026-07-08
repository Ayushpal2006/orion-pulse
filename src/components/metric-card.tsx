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
    <div className="card-soft p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && (
          <div className={cn("grid size-9 place-items-center rounded-xl", accentBg)}>{icon}</div>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="tabular text-3xl font-semibold tracking-tight">{value}</div>
        {typeof delta === "number" && (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              up ? "bg-success/15 text-success-foreground" : "bg-danger/10 text-danger",
            )}
          >
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {up ? "+" : ""}
            {delta}%
          </div>
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
