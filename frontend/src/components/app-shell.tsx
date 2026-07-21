import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Search, Wifi, WifiOff, Settings, LogOut, UserCog, Truck, Receipt, Sliders, TrendingUp, History, CreditCard, Wallet, ChevronDown, ChevronRight, Menu, X
} from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose
} from "@/components/ui/sheet";
import { useApp, type Role } from "@/lib/store";
import { CommandPalette } from "./command-palette";
import { ThemeToggle, useThemeInit } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { getProducts, getCustomers } from "@/lib/api";

export type NavItem = { to: string; label: string; icon: any; exact?: boolean; roles?: Role[] };
export type NavGroup = { label: string; icon: any; items: NavItem[]; roles?: Role[] };
export type NavElement = NavItem | NavGroup;

function isGroup(item: NavElement): item is NavGroup {
  return "items" in item;
}

const navTree: NavElement[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/billing", label: "Billing", icon: ShoppingCart },
  {
    label: "Inventory",
    icon: Package,
    items: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/adjust-stock", label: "Adjust Stock", icon: Sliders },
      { to: "/stock-history", label: "Stock History", icon: History },

    ],
  },
  {
    label: "Contacts",
    icon: Users,
    items: [
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/suppliers", label: "Suppliers", icon: Truck },
    ],
  },
  { to: "/purchases", label: "Purchases", icon: Receipt },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["Admin", "Manager"] },
  {
    label: "Finance",
    icon: Wallet,
    roles: ["Admin", "Manager"],
    items: [
      { to: "/profit", label: "Profit", icon: TrendingUp },
      { to: "/expenses", label: "Expenses", icon: CreditCard },
    ],
  },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["Admin", "Manager"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  useThemeInit();
  const setPaletteOpen = useApp((s) => s.setPaletteOpen);
  const role = useApp((s) => s.role);
  const setRole = useApp((s) => s.setRole);
  const setProducts = useApp((s) => s.setProducts);
  const setCustomers = useApp((s) => s.setCustomers);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Mobile menu drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Accordion open states for nav groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Inventory: true,
    Contacts: true,
    Finance: true,
  });

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  };

  useEffect(() => {
    // Auto expand group if currently on a sub-route
    navTree.forEach((elem) => {
      if (isGroup(elem)) {
        if (elem.items.some((sub) => pathname === sub.to || pathname.startsWith(sub.to + "/"))) {
          setOpenGroups((prev) => ({ ...prev, [elem.label]: true }));
        }
      }
    });
  }, [pathname]);

  useEffect(() => {
    // 1. Fetch products
    getProducts()
      .then(setProducts)
      .catch((err) => console.error("AppShell products fetch failed:", err));

    // 2. Fetch customers
    getCustomers()
      .then((data) => {
        const mapped = data.map((c: any) => ({
          ...c,
          loyaltyPoints: c.loyalty_points ?? c.loyaltyPoints ?? 0,
          totalSpent: c.total_spent ?? c.totalSpent ?? 0,
        }));
        setCustomers(mapped);
      })
      .catch((err) => console.error("AppShell customers fetch failed:", err));
  }, [setProducts, setCustomers]);

  const hasRole = (roles?: Role[]) => {
    if (!roles || roles.length === 0) return true;
    return roles.includes(role);
  };

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return pathname === to || (to === "/dashboard" && pathname === "/");
    return pathname === to || pathname.startsWith(to + "/");
  };

  const renderNavItems = (onItemClick?: () => void) => {
    return navTree.map((elem, idx) => {
      if (!hasRole(elem.roles)) return null;

      if (isGroup(elem)) {
        const GroupIcon = elem.icon;
        const isOpen = openGroups[elem.label] ?? false;
        const isGroupActive = elem.items.some((sub) => isActive(sub.to, sub.exact));

        return (
          <div key={elem.label || idx} className="space-y-1">
            <button
              onClick={() => toggleGroup(elem.label)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isGroupActive ? "text-primary font-semibold" : "text-ink-soft hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <GroupIcon className="size-4" />
                <span>{elem.label}</span>
              </div>
              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
            {isOpen && (
              <div className="ml-3 space-y-1 border-l border-border/60 pl-2">
                {elem.items.map((sub) => {
                  if (!hasRole(sub.roles)) return null;
                  const SubIcon = sub.icon;
                  const active = isActive(sub.to, sub.exact);
                  return (
                    <Link
                      key={sub.to}
                      to={sub.to}
                      onClick={onItemClick}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs font-medium transition-colors min-h-[40px]",
                        active ? "bg-primary text-primary-foreground font-semibold" : "text-ink-soft hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <SubIcon className="size-3.5" />
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      const Icon = elem.icon;
      const active = isActive(elem.to, elem.exact);
      return (
        <Link
          key={elem.to}
          to={elem.to}
          onClick={onItemClick}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
            active ? "bg-primary text-primary-foreground font-semibold" : "text-ink-soft hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
          {elem.label}
        </Link>
      );
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-elevated/60 backdrop-blur lg:flex">
        <div className="flex h-16 items-center gap-2 px-6 border-b border-border/40">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground font-extrabold text-lg shadow-sm">
            O
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-base leading-tight">Orion POS</span>
            <span className="text-[10px] text-muted-foreground font-medium">Store #001 · Production</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
          {renderNavItems()}
        </nav>
        <div className="p-3">
          <OfflineBadge />
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-elevated/80 backdrop-blur lg:pl-60">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          {/* Mobile menu trigger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden size-10 rounded-xl">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex flex-col">
              <SheetHeader className="p-4 border-b border-border text-left flex flex-row items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground font-extrabold text-lg shadow-sm">
                  O
                </div>
                <div>
                  <SheetTitle className="text-base font-bold">Orion POS</SheetTitle>
                  <p className="text-[10px] text-muted-foreground">Store #001 · Navigation</p>
                </div>
              </SheetHeader>
              <nav className="flex-1 p-3 overflow-y-auto space-y-1.5">
                {renderNavItems(() => setMobileMenuOpen(false))}
              </nav>
              <div className="p-3 border-t border-border">
                <OfflineBadge />
              </div>
            </SheetContent>
          </Sheet>

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
          {[
            { to: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
            { to: "/billing", label: "Billing", icon: ShoppingCart },
            { to: "/products", label: "Products", icon: Package },
            { to: "/purchases", label: "Purchases", icon: Receipt },
          ].map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn("flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors touch-manipulation", active ? "text-foreground" : "text-muted-foreground")}
              >
                <div className={cn("grid size-9 place-items-center rounded-xl transition-colors", active ? "bg-primary text-primary-foreground" : "")}>
                  <Icon className="size-[18px]" />
                </div>
                {n.label}
              </Link>
            );
          })}
          {/* Menu button on mobile bottom bar opens full drawer */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground touch-manipulation"
          >
            <div className="grid size-9 place-items-center rounded-xl">
              <Menu className="size-[18px]" />
            </div>
            Menu
          </button>
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
