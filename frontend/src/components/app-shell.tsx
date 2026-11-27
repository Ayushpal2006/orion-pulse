import { useEffect, useState, useMemo, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Search,
  Wifi,
  WifiOff,
  Settings,
  LogOut,
  UserCog,
  Truck,
  Receipt,
  Sliders,
  TrendingUp,
  History,
  CreditCard,
  Wallet,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Store,
  Check,
  Building2,
  RefreshCw,
  FileText,
} from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useApp, type Role } from "@/lib/store";
import { CommandPalette } from "./command-palette";
import { ThemeToggle, useThemeInit } from "./theme-toggle";
import { cn } from "@/lib/utils";
import {
  getProducts,
  getCustomers,
  getStores,
  switchStore,
  logoutApi,
  getCurrentUserApi,
  getSuperAdminOrganizations,
  fetchAndApplyStoreSettings,
} from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { printerProfileService } from "@/lib/printer-profile.service";

export type NavItem = { to: string; label: string; icon: any; exact?: boolean; roles?: Role[] };
export type NavGroup = { label: string; icon: any; items: NavItem[]; roles?: Role[] };
export type NavElement = NavItem | NavGroup;

function isGroup(item: NavElement): item is NavGroup {
  return "items" in item;
}

function OrganizationSwitcher() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [activeOrg, setActiveOrg] = useState<any>(null);

  useEffect(() => {
    getSuperAdminOrganizations()
      .then((res) => {
        if (Array.isArray(res)) {
          setOrgs(res);
          const savedOrgId = localStorage.getItem("currentOrgId");
          const found = res.find((o: any) => String(o.id) === savedOrgId) || res[0];
          if (found) {
            setActiveOrg(found);
            localStorage.setItem("currentOrgId", String(found.id));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectOrg = (org: any) => {
    setActiveOrg(org);
    localStorage.setItem("currentOrgId", String(org.id));
    localStorage.removeItem("currentStoreId");

    // Clear stale organization settings from localStorage
    localStorage.removeItem("orion_shop_name");
    localStorage.removeItem("orion_gstin");
    localStorage.removeItem("orion_logo");
    localStorage.removeItem("orion_address");
    localStorage.removeItem("orion_phone");
    localStorage.removeItem("orion_email");
    localStorage.removeItem("orion_upi_id");
    localStorage.removeItem("orion_inv_prefix");
    localStorage.removeItem("orion_po_prefix");
    localStorage.removeItem("orion_receipt_footer");
    localStorage.removeItem("orion_receipt_template");

    toast.success(`Organization: ${org.name}`);
    window.location.reload();
  };

  if (orgs.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl text-xs font-medium border-border/60 bg-background/50 hover:bg-accent"
        >
          <Building2 className="size-3.5 text-primary shrink-0" />
          <span className="truncate max-w-[110px] sm:max-w-[140px] font-semibold">
            {activeOrg?.name || "Organization"}
          </span>
          <ChevronDown className="size-3 opacity-60 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch Organization
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((o) => (
          <DropdownMenuItem
            key={o.id}
            onClick={() => handleSelectOrg(o)}
            className="flex items-center justify-between cursor-pointer rounded-lg text-xs"
          >
            <div className="flex flex-col">
              <span
                className={cn(
                  "font-medium",
                  o.id === activeOrg?.id ? "text-primary font-bold" : "",
                )}
              >
                {o.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ID: #{o.id} ({o.status})
              </span>
            </div>
            {o.id === activeOrg?.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StoreSwitcher() {
  const queryClient = useQueryClient();
  const activeStoreId = useApp((s) => s.activeStoreId);
  const activeStoreName = useApp((s) => s.activeStoreName);
  const storesList = useApp((s) => s.storesList);
  const setActiveStoreId = useApp((s) => s.setActiveStoreId);
  const setActiveStoreName = useApp((s) => s.setActiveStoreName);
  const setProducts = useApp((s) => s.setProducts);
  const setCustomers = useApp((s) => s.setCustomers);
  const resetTenantState = useApp((s) => s.resetTenantState);

  const handleSwitch = async (store: any) => {
    if (store.id === activeStoreId) return;
    try {
      await switchStore(store.id);
      queryClient.clear();
      printerProfileService.clearCache();
      resetTenantState();
      setActiveStoreId(store.id);
      setActiveStoreName(store.name);
      localStorage.setItem("currentStoreId", String(store.id));
      toast.success(`Switched to store: ${store.name}`);
      // Refetch data for newly selected store and refresh tenant cache
      const [prods, custs] = await Promise.all([getProducts(), getCustomers(), fetchAndApplyStoreSettings()]);
      setProducts(prods);
      setCustomers(
        custs.map((c: any) => ({
          ...c,
          loyaltyPoints: c.loyalty_points ?? c.loyaltyPoints ?? 0,
          totalSpent: c.total_spent ?? c.totalSpent ?? 0,
        })),
      );
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to switch store");
    }
  };

  if (storesList.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/60 border border-border/50 text-xs font-medium text-muted-foreground">
        <Store className="size-3.5 text-primary shrink-0" />
        <span className="truncate max-w-[120px] sm:max-w-[150px] font-semibold text-foreground">
          {activeStoreName || "Main Store"}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl text-xs font-medium border-border/60 bg-background/50 hover:bg-accent"
        >
          <Store className="size-3.5 text-primary shrink-0" />
          <span className="truncate max-w-[110px] sm:max-w-[140px] font-semibold">
            {activeStoreName}
          </span>
          <ChevronDown className="size-3 opacity-60 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch Active Store
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {storesList.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => handleSwitch(s)}
            disabled={s.status === "disabled"}
            className="flex items-center justify-between cursor-pointer rounded-lg text-xs"
          >
            <div className="flex flex-col">
              <span
                className={cn(
                  "font-medium",
                  s.id === activeStoreId ? "text-primary font-bold" : "",
                )}
              >
                {s.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {s.code ? `Code: ${s.code}` : `ID: #${s.id}`}{" "}
                {s.status === "disabled" ? "(Disabled)" : ""}
              </span>
            </div>
            {s.id === activeStoreId && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const navTree: NavElement[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    roles: ["Super Admin", "Admin", "Manager"],
  },
  {
    to: "/billing",
    label: "Billing",
    icon: ShoppingCart,
    roles: ["Super Admin", "Admin", "Manager", "Cashier"],
  },
  {
    label: "Inventory",
    icon: Package,
    roles: ["Super Admin", "Admin", "Manager", "Cashier"],
    items: [
      {
        to: "/products",
        label: "Products",
        icon: Package,
        roles: ["Super Admin", "Admin", "Manager", "Cashier"],
      },
      {
        to: "/adjust-stock",
        label: "Adjust Stock",
        icon: Sliders,
        roles: ["Super Admin", "Admin", "Manager"],
      },
      {
        to: "/stock-history",
        label: "Stock History",
        icon: History,
        roles: ["Super Admin", "Admin", "Manager"],
      },
    ],
  },
  {
    label: "Contacts",
    icon: Users,
    roles: ["Super Admin", "Admin", "Manager", "Cashier"],
    items: [
      {
        to: "/customers",
        label: "Customers",
        icon: Users,
        roles: ["Super Admin", "Admin", "Manager", "Cashier"],
      },
      {
        to: "/suppliers",
        label: "Suppliers",
        icon: Truck,
        roles: ["Super Admin", "Admin", "Manager"],
      },
    ],
  },
  {
    to: "/purchases",
    label: "Purchases",
    icon: Receipt,
    roles: ["Super Admin", "Admin", "Manager"],
  },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["Super Admin", "Admin", "Manager"] },
  {
    label: "Finance",
    icon: Wallet,
    roles: ["Super Admin", "Admin", "Manager"],
    items: [
      {
        to: "/profit",
        label: "Profit",
        icon: TrendingUp,
        roles: ["Super Admin", "Admin", "Manager"],
      },
      {
        to: "/expenses",
        label: "Expenses",
        icon: CreditCard,
        roles: ["Super Admin", "Admin", "Manager"],
      },
    ],
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    roles: ["Super Admin", "Admin", "Manager"],
  },
  { to: "/super-admin", label: "Super Admin", icon: UserCog, roles: ["Super Admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  useThemeInit();
  const queryClient = useQueryClient();
  const setPaletteOpen = useApp((s) => s.setPaletteOpen);
  const role = useApp((s) => s.role);
  const setRole = useApp((s) => s.setRole);
  const setProducts = useApp((s) => s.setProducts);
  const setCustomers = useApp((s) => s.setCustomers);
  const setActiveStoreId = useApp((s) => s.setActiveStoreId);
  const activeStoreName = useApp((s) => s.activeStoreName);
  const setActiveStoreName = useApp((s) => s.setActiveStoreName);
  const setStoresList = useApp((s) => s.setStoresList);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Mobile menu drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

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

  const handleLogout = async () => {
    try {
      await logoutApi();
      toast.success("Logged out successfully");
    } catch (e) {
      // ignore
    } finally {
      queryClient.clear();
      useApp.getState().resetTenantState();
      localStorage.removeItem("token");
      localStorage.removeItem("currentOrgId");
      localStorage.removeItem("currentStoreId");
      localStorage.removeItem("apka_cached_session");
      localStorage.removeItem("apka_cached_stores");
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    // 1. Synchronous route & session guard on navigation
    const token = localStorage.getItem("token");
    if (!token && pathname !== "/login") {
      window.location.href = "/login";
      return;
    }

    const isAdminRoute =
      pathname === "/admin" || pathname.startsWith("/admin") || pathname.startsWith("/super-admin");
    const roleLower = (currentUser?.role || role || "").toLowerCase();
    const isSuperAdminUser = roleLower === "super_admin" || roleLower === "superadmin";

    // Role-Based Portal Guard:
    // 1. Cashier is restricted to /billing, /customers, /products
    if (roleLower === "cashier") {
      const isAllowedForCashier =
        pathname === "/billing" || pathname === "/customers" || pathname === "/products";
      if (!isAllowedForCashier) {
        window.location.href = "/billing";
        return;
      }
    }

    // 2. Super Admin is restricted to /admin
    if (isSuperAdminUser && !isAdminRoute) {
      window.location.href = "/admin";
      return;
    }

    // 3. Non-Super Admin cannot access /admin
    if (!isSuperAdminUser && isAdminRoute && roleLower) {
      window.location.href = "/dashboard";
      return;
    }
  }, [pathname, currentUser, role]);

  useEffect(() => {
    // 2. Initial session bootstrap & data loading (runs ONCE on mount, NOT on route changes)
    const token = localStorage.getItem("token");
    if (!token || pathname === "/login") return;

    const isAdminRoute =
      pathname === "/admin" || pathname.startsWith("/admin") || pathname.startsWith("/super-admin");

    const applyUserSession = (data: any) => {
      if (data?.user) {
        setCurrentUser(data.user);
        const roleLower = (data.user.role || "").toLowerCase();
        const isSuperAdminUser = roleLower === "super_admin" || roleLower === "superadmin";
        const formattedRole: Role = isSuperAdminUser
          ? "Super Admin"
          : roleLower === "cashier"
            ? "Cashier"
            : roleLower === "manager"
              ? "Manager"
              : "Admin";
        setRole(formattedRole);
      }
      if (
        !isAdminRoute &&
        data?.organization &&
        (data.organization.onboarding_completed === 0 ||
          data.organization.onboarding_completed === false) &&
        pathname !== "/setup-wizard"
      ) {
        window.location.href = "/setup-wizard";
      }
    };

    getCurrentUserApi()
      .then((data) => {
        applyUserSession(data);
      })
      .catch((err) => {
        // Only terminate session when the server explicitly rejects the token (401/403).
        // Network/offline startup must keep the user logged in with cached data so offline billing works.
        if (err?.status === 401 || err?.status === 403) {
          console.warn("Session invalid or expired:", err);
          handleLogout();
          return;
        }
        console.warn("Offline session check — restoring last cached user profile:", err?.message);
        try {
          const cachedRaw = localStorage.getItem("apka_cached_session");
          if (cachedRaw) {
            applyUserSession(JSON.parse(cachedRaw));
          }
        } catch (_) {}
      });

    // Always hydrate products, customers & settings (even offline) without nesting inside getStores()
    if (!isAdminRoute) {
      const hydrateOfflineOrRemoteData = () =>
        Promise.all([
          queryClient
            .fetchQuery({ queryKey: ["products"], queryFn: getProducts })
            .then(setProducts)
            .catch((err) => console.error("AppShell products fetch failed:", err)),
          queryClient
            .fetchQuery({ queryKey: ["customers"], queryFn: getCustomers })
            .then((data) => {
              const mapped = (data || []).map((c: any) => ({
                ...c,
                loyaltyPoints: c.loyalty_points ?? c.loyaltyPoints ?? 0,
                totalSpent: c.total_spent ?? c.totalSpent ?? 0,
              }));
              setCustomers(mapped);
            })
            .catch((err) => console.error("AppShell customers fetch failed:", err)),
          fetchAndApplyStoreSettings()
            .then((settings) => {
              if (settings) {
                queryClient.setQueryData(["settings"], settings);
              }
            })
            .catch((err) => console.error("AppShell settings fetch failed:", err)),
        ]);

      getStores()
        .then((stores) => {
          setStoresList(stores);
          try {
            localStorage.setItem("apka_cached_stores", JSON.stringify(stores || []));
          } catch (_) {}
          if (stores && stores.length > 0) {
            const savedStoreIdRaw = localStorage.getItem("currentStoreId");
            const savedStoreId = savedStoreIdRaw ? parseInt(savedStoreIdRaw, 10) : null;
            const found =
              stores.find((st: any) => st.id === savedStoreId) ||
              stores.find((st: any) => st.is_default === 1) ||
              stores[0];
            if (found) {
              setActiveStoreId(found.id);
              setActiveStoreName(found.name);
              localStorage.setItem("currentStoreId", String(found.id));
            }
          }
          hydrateOfflineOrRemoteData();
        })
        .catch((err) => {
          console.warn("AppShell stores fetch failed (offline fallback):", err?.message);
          try {
            const cachedStoresRaw = localStorage.getItem("apka_cached_stores");
            if (cachedStoresRaw) {
              const stores = JSON.parse(cachedStoresRaw);
              if (Array.isArray(stores) && stores.length > 0) {
                setStoresList(stores);
                const savedStoreIdRaw = localStorage.getItem("currentStoreId");
                const savedStoreId = savedStoreIdRaw ? parseInt(savedStoreIdRaw, 10) : null;
                const found =
                  stores.find((st: any) => st.id === savedStoreId) ||
                  stores.find((st: any) => st.is_default === 1) ||
                  stores[0];
                if (found) {
                  setActiveStoreId(found.id);
                  setActiveStoreName(found.name);
                }
              }
            }
          } catch (_) {}
          hydrateOfflineOrRemoteData();
        });
    }
    // Bootstrap load, intentionally mount-only: `pathname` is read only as a route
    // guard, so listing it would re-run the whole store/product/customer fetch on
    // every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queryClient,
    setProducts,
    setCustomers,
    setActiveStoreId,
    setActiveStoreName,
    setStoresList,
    setRole,
  ]);

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
                isGroupActive
                  ? "text-primary font-semibold"
                  : "text-ink-soft hover:bg-muted hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-3">
                <GroupIcon className="size-4" />
                <span>{elem.label}</span>
              </div>
              {isOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
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
                        active
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-ink-soft hover:bg-muted hover:text-foreground",
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
            active
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-ink-soft hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {elem.label}
        </Link>
      );
    });
  };

  // The super-admin panel has its own sidebar and top bar; the shop shell around it only crowds it.
  if (pathname.startsWith("/admin") || pathname.startsWith("/super-admin")) return <>{children}</>;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-elevated/60 backdrop-blur lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-4 border-b border-border/40 justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Apka Bill Logo"
              className="size-8 rounded-xl object-cover shadow-sm border border-border/50"
            />
            <span className="font-bold tracking-tight text-base leading-tight">Apka Bill</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">{renderNavItems()}</nav>
        <div className="p-3">
          <OfflineBadge />
        </div>
      </aside>

      {/* Top bar (respects Android edge-to-edge status bar safe area) */}
      <header className="sticky top-0 z-20 border-b border-border bg-elevated/90 backdrop-blur pt-[env(safe-area-inset-top)] lg:pl-60">
        <div className="flex h-16 items-center gap-2 sm:gap-3 px-3 sm:px-6 min-w-0">
          {/* Mobile menu trigger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden size-11 shrink-0 rounded-xl">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 max-w-[85vw] p-0 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            >
              <SheetHeader className="p-4 border-b border-border text-left flex flex-row items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <img
                    src="/logo.png"
                    alt="Apka Bill Logo"
                    className="size-8 rounded-xl object-cover shadow-sm border border-border/50"
                  />
                  <SheetTitle className="text-base font-bold">Apka Bill</SheetTitle>
                </div>
                <StoreSwitcher />
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
            className="group flex h-11 min-w-0 flex-1 max-w-xl items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search products, customers, bills…</span>
            <kbd className="ml-auto hidden rounded-md border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-medium sm:inline-block shrink-0">
              ⌘K
            </kbd>
          </button>

          {/* Role-Specific Top Bar Controls */}
          <div className="hidden sm:flex items-center gap-2">
            {role === "Super Admin" && (
              <>
                <OrganizationSwitcher />
                <StoreSwitcher />
              </>
            )}
            {role === "Admin" && <StoreSwitcher />}
            {role === "Manager" && <StoreSwitcher />}
            {role === "Cashier" && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 border border-border/50 text-xs font-semibold text-foreground">
                <Store className="size-3.5 text-primary shrink-0" />
                <span>{activeStoreName || "Main Store"}</span>
              </div>
            )}
          </div>

          <div className="lg:hidden shrink-0">
            <OfflineBadge compact />
          </div>
          <div className="hidden lg:block">
            <OfflineBadge />
          </div>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10 rounded-full bg-muted">
                <span className="text-xs font-bold">
                  {role === "Super Admin"
                    ? "SA"
                    : role === "Admin"
                      ? "AD"
                      : role === "Manager"
                        ? "MG"
                        : "CS"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">
                    {currentUser?.name || (role === "Cashier" ? "Cashier" : "User")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Signed in as {role}</span>
                </div>
              </DropdownMenuLabel>
              {role !== "Cashier" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Switch role
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
                    <DropdownMenuRadioItem value="Admin">Organization Admin</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Manager">Store Manager</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Cashier">Cashier</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </>
              )}
              <DropdownMenuSeparator />
              {role !== "Cashier" && (
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main */}
      <main className="pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-8 lg:pl-60">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</div>
      </main>

      {/* Mobile bottom nav (respects Android gesture navigation bar safe area) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-elevated/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className={cn("grid", role === "Cashier" ? "grid-cols-3" : "grid-cols-5")}>
          {(role === "Cashier"
            ? [
                { to: "/billing", label: "Billing", icon: ShoppingCart },
                { to: "/products", label: "Products", icon: Package },
                { to: "/customers", label: "Customers", icon: Users },
              ]
            : [
                { to: "/", label: "Home", icon: LayoutDashboard, exact: true },
                { to: "/billing", label: "Billing", icon: ShoppingCart },
                { to: "/products", label: "Products", icon: Package },
                { to: "/purchases", label: "Purchases", icon: Receipt },
                { to: "/customers", label: "Customers", icon: Users },
              ]
          ).map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 min-h-[54px] text-[11px] font-medium transition-colors touch-manipulation",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "grid size-8 place-items-center rounded-xl transition-colors",
                    active ? "bg-primary text-primary-foreground" : "",
                  )}
                >
                  <Icon className="size-[18px]" />
                </div>
                <span className="truncate max-w-full px-0.5">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <CommandPalette />
    </div>
  );
}

function OfflineBadge({ compact = false }: { compact?: boolean }) {
  const { isOnline, isSyncing, pendingCount, syncNow } = usePWA();

  if (isSyncing) {
    return (
      <button
        onClick={() => syncNow()}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
      >
        <RefreshCw className="size-3.5 animate-spin shrink-0" />
        <span>{compact ? `${pendingCount}` : `Syncing... (${pendingCount})`}</span>
      </button>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        onClick={() => syncNow()}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
        title="Tap to sync pending offline bills"
      >
        <RefreshCw className="size-3.5 shrink-0" />
        <span>{compact ? `${pendingCount} Sync` : `Sync (${pendingCount} pending)`}</span>
      </button>
    );
  }

  if (isOnline) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
        title="Connected Online"
      >
        <span className="relative flex size-2 shrink-0">
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        {!compact && (
          <>
            <Wifi className="size-3.5" />
            <span>Online</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 animate-pulse"
      title="Offline Mode Active"
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span>{compact ? "Off" : "Offline"}</span>
    </div>
  );
}
