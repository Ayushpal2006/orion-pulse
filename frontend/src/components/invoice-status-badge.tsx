import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const normalized = (status || "").toUpperCase();

  switch (normalized) {
    case "COMPLETED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success-foreground uppercase tracking-wider",
            className
          )}
        >
          <CheckCircle2 className="size-3" />
          Completed
        </span>
      );
    case "VOID":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 text-[10px] font-bold text-danger-foreground uppercase tracking-wider",
            className
          )}
        >
          <AlertTriangle className="size-3" />
          Void
        </span>
      );
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider",
            className
          )}
        >
          <HelpCircle className="size-3" />
          {status}
        </span>
      );
  }
}
