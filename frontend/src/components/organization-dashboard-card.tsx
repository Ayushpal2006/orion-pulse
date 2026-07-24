import { useQuery } from "@tanstack/react-query";
import { getOrganizationDashboard } from "@/lib/api";
import { inr } from "@/lib/format";
import { Building2, Store, Users, ShoppingBag, TrendingUp, Package, ShieldCheck, History, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function OrganizationDashboardCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["organization-dashboard"],
    queryFn: getOrganizationDashboard,
  });

  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl border border-border/60 bg-card animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    organizationName,
    activeStores = 0,
    activeUsers = 0,
    todaySales = 0,
    monthlySales = 0,
    inventoryValue = 0,
    auditLogs = [],
  } = data;

  return (
    <div className="p-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground font-bold shadow-sm">
            <Building2 className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base tracking-tight text-foreground">{organizationName}</h2>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">SaaS Enterprise</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Organization Executive Overview</p>
          </div>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl border border-border/50 bg-background/60 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Active Outlets</span>
            <Store className="size-3.5 text-primary" />
          </div>
          <div className="text-lg font-bold text-foreground">{activeStores}</div>
          <div className="text-[10px] text-muted-foreground">Stores Operating</div>
        </div>

        <div className="p-3 rounded-xl border border-border/50 bg-background/60 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Active Team</span>
            <Users className="size-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-foreground">{activeUsers}</div>
          <div className="text-[10px] text-muted-foreground">Users Authorized</div>
        </div>

        <div className="p-3 rounded-xl border border-border/50 bg-background/60 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Today's Sales</span>
            <ShoppingBag className="size-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{inr(todaySales / 100)}</div>
          <div className="text-[10px] text-muted-foreground">Org-wide Revenue</div>
        </div>

        <div className="p-3 rounded-xl border border-border/50 bg-background/60 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Monthly Sales</span>
            <TrendingUp className="size-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-foreground">{inr(monthlySales / 100)}</div>
          <div className="text-[10px] text-muted-foreground">MTD Total</div>
        </div>

        <div className="p-3 rounded-xl border border-border/50 bg-background/60 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Inventory Value</span>
            <Package className="size-3.5 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-foreground">{inr(inventoryValue / 100)}</div>
          <div className="text-[10px] text-muted-foreground">Total Valuation</div>
        </div>
      </div>

      {/* AUDIT LOG SNAPSHOT */}
      {auditLogs.length > 0 && (
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5"><Activity className="size-3.5 text-primary" /> Organization Audit Activity</span>
            <span className="text-[10px] text-muted-foreground font-normal">{auditLogs.length} events logged</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            {auditLogs.slice(0, 4).map((log: any) => (
              <div key={log.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background/50 shrink-0 text-[11px]">
                <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">
                  {log.action}
                </Badge>
                <span className="truncate max-w-[200px] text-muted-foreground">{log.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
