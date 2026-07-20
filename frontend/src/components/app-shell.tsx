import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Search, Wifi, WifiOff, Settings, LogOut, UserCog, Truck, Receipt, Sliders, TrendingUp
} from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp, type Role } from "@/lib/store";
import { CommandPalette } from "./command-palette";
import { ThemeToggle, useThemeInit } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { getProducts, getCustomers, API_BASE_URL } from "@/lib/api";

const nav: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/billing", label: "Billing", icon: ShoppingCart },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/purchases", label: "Purchases", icon: Receipt },
  { to: "/stock-adjustments", label: "Adjustments", icon: Sliders },
  { to: "/profit", label: "Profit", icon: TrendingUp },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  useThemeInit();
  const setPaletteOpen = useApp((s) => s.setPaletteOpen);
  const role = useApp((s) => s.role);
  const setRole = useApp((s) => s.setRole);
  const setProducts = useApp((s) => s.setProducts);
  const setCustomers = useApp((s) => s.setCustomers);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    // 1. Fetch products
    getProducts()
      .then(setProducts)
      .catch((err) => console.error("AppShell products fetch failed:", err));

    // 2. Fetch customers
    getCustomers()
      .then((data) => {
        const mapped = data.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          mobile: c.phone,
          ltv: (c.lifetime_value ?? 0) / 100,
          visits: c.total_orders ?? 0,
          lastVisit: c.last_visit ? new Date(c.last_visit).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Never",
          since: c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Recently",
          email: c.email || undefined,
          address: c.address || undefined,
          notes: c.notes || undefined,
        }));
        setCustomers(mapped);
      })
      .catch((err) => console.error("AppShell customers fetch failed:", err));

    // 3. Fetch settings
    fetch(`${API_BASE_URL}/settings`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data;
          const store = useApp.getState();
          if (d.shop_name) store.setShopName(d.shop_name);
          if (d.shop_gstin) store.setGstin(d.shop_gstin);
          if (d.shop_phone) store.setStorePhone(d.shop_phone);
          if (d.shop_address) store.setStoreAddress(d.shop_address);
          if (d.shop_upi_id) store.setUpiId(d.shop_upi_id);
          if (d.printer_type) store.setPrinter(d.printer_type as any);
          if (d.paper_width) store.setPaperWidth(d.paper_width as any);
          if (d.whatsapp_footer) store.setWhatsappFooter(d.whatsapp_footer);
          if (d.logo) store.setLogo(d.logo);
          if (d.require_customer_before_checkout !== undefined) {
            store.setRequireCustomerBeforeCheckout(d.require_customer_before_checkout === "1");
          }
        }
      })
      .catch((err) => console.error("AppShell settings fetch failed:", err));
  }, [setProducts, setCustomers]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-surface text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-elevated lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground font-black">O</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Orion POS</div>
            <div className="text-[11px] text-muted-foreground">Retail OS · v1.4</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-ink-soft hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <OfflineBadge />
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-elevated/80 backdrop-blur lg:pl-60">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setPaletteOpen(true)}
            className="group flex h-10 flex-1 max-w-xl items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <Search className="size-4" />
            <span className="truncate">Search products, customers, invoices…</span>
            <kbd className="ml-auto hidden rounded-md border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">⌘K</kbd>
          </button>

          <div className="hidden lg:block">
            <OfflineBadge />
          </div>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10 rounded-full bg-muted">
                <span className="text-sm font-semibold">
                  {role === "Admin" ? "AD" : role === "Manager" ? "MG" : "CS"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Signed in as {role}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Switch role</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
                <DropdownMenuRadioItem value="Admin">Admin</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Manager">Manager</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Cashier">Cashier</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              {role !== "Cashier" && (
                <DropdownMenuItem asChild>
                  <Link to="/settings"><Settings className="mr-2 size-4" /> Settings</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem><UserCog className="mr-2 size-4" /> Account</DropdownMenuItem>
              <DropdownMenuItem><LogOut className="mr-2 size-4" /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main */}
      <main className="pb-24 lg:pb-8 lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-elevated/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")}
              >
                <div className={cn("grid size-9 place-items-center rounded-xl transition-colors", active ? "bg-primary text-primary-foreground" : "")}>
                  <Icon className="size-[18px]" />
                </div>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <CommandPalette />
    </div>
  );
}

function OfflineBadge() {
  const { isOnline } = usePWA();

  if (isOnline) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        <Wifi className="size-3.5" />
        Online Mode Active
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive-foreground animate-pulse">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-destructive" />
      </span>
      <WifiOff className="size-3.5" />
      Connection Lost
    </div>
  );
}
