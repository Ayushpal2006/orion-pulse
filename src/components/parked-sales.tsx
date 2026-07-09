import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { PauseCircle, PlayCircle, Trash2, Inbox } from "lucide-react";
import { useApp, cartTotals } from "@/lib/store";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export function ParkedSalesPopover() {
  const parked = useApp((s) => s.parkedSales);
  const resume = useApp((s) => s.resumeSale);
  const del = useApp((s) => s.deleteParkedSale);
  const currentCart = useApp((s) => s.cart);

  const doResume = (id: string) => {
    if (currentCart.length > 0) {
      const ok = window.confirm("Current cart will be replaced. Continue?");
      if (!ok) return;
    }
    resume(id);
    toast.success("Sale resumed");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-xl">
          <Inbox className="mr-1.5 size-4" />
          Parked
          {parked.length > 0 && (
            <span className="ml-1.5 rounded-full bg-warn/30 px-1.5 text-[10px] font-semibold text-warn-foreground">
              {parked.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border p-3">
          <div className="text-sm font-semibold">Parked sales</div>
          <div className="text-xs text-muted-foreground">Held carts waiting to resume</div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {parked.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <PauseCircle className="mx-auto mb-2 size-6 opacity-50" />
              No sales on hold.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {parked.map((p) => {
                const t = cartTotals(p.cart);
                return (
                  <li key={p.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.cart.length} items · {new Date(p.savedAt).toLocaleTimeString()}
                        </div>
                        <div className="mt-1 tabular text-xs font-semibold text-money">
                          {inr(t.total)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 justify-start px-2 text-xs"
                          onClick={() => doResume(p.id)}
                        >
                          <PlayCircle className="mr-1 size-3.5" /> Resume
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 justify-start px-2 text-xs text-danger hover:text-danger"
                          onClick={() => del(p.id)}
                        >
                          <Trash2 className="mr-1 size-3.5" /> Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
