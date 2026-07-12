import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center animate-fade-in",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="text-sm font-semibold">{title}</div>
      {description && (
        <div className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
