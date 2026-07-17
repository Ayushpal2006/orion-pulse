import { InvoiceStatusBadge } from "./invoice-status-badge";
import { inr } from "@/lib/format";
import { formatToKolkataDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Calendar, User, CreditCard } from "lucide-react";

export interface InvoiceCardProps {
  invoice: {
    id: number;
    invoice_number: string;
    customer_id?: number | null;
    cashier_name?: string | null;
    payment_method: string;
    subtotal: number;
    discount: number;
    gst: number;
    grand_total: number;
    created_at: string;
    customer_name?: string | null;
    customer_phone?: string | null;
    status: string;
  };
  onClick: () => void;
}

export function InvoiceCard({ invoice, onClick }: InvoiceCardProps) {
  const isVoid = invoice.status === "VOID";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border border-border bg-elevated p-4 text-left shadow-sm hover:shadow-md hover:bg-muted/20 transition-all cursor-pointer relative overflow-hidden",
        isVoid && "border-rose-500/20 bg-rose-500/[0.01]"
      )}
    >
      {/* Top row: Invoice #, Status, Grand Total */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">
            {invoice.invoice_number}
          </span>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="tabular text-sm font-black text-foreground">
          {inr(invoice.grand_total / 100)}
        </div>
      </div>

      {/* Middle row: Customer Details, Cashier */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-0.5">
        <div className="flex items-center gap-1.5 truncate">
          <User className="size-3.5 shrink-0" />
          <span className="truncate">
            {invoice.customer_name || "Walk-in Customer"}
            {invoice.customer_phone ? ` (${invoice.customer_phone})` : ""}
          </span>
        </div>
        <div className="text-right truncate">
          Cashier: <span className="font-semibold text-foreground">{invoice.cashier_name || "Admin"}</span>
        </div>
      </div>

      {/* Bottom row: Date/Time, Payment Method */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2 mt-1">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5 text-muted-foreground" />
          <span>{formatToKolkataDateTime(invoice.created_at)}</span>
        </div>
        <div className="flex items-center gap-1">
          <CreditCard className="size-3 text-muted-foreground" />
          <span className="font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
            {invoice.payment_method}
          </span>
        </div>
      </div>
    </button>
  );
}
