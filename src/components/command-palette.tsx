import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Package, Users, Receipt, LayoutDashboard, ScanBarcode, Plus, Settings, BarChart3, Tag, Sun, Moon, Monitor,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { invoices } from "@/lib/mock-data";

export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const setOpen = useApp((s) => s.setPaletteOpen);
  const addToCart = useApp((s) => s.addToCart);
  const products = useApp((s) => s.products);
  const customers = useApp((s) => s.customers);
  const setTheme = useApp((s) => s.setTheme);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  const categories = Array.from(new Set(products.map((p) => p.category)));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search products, customers, invoices, actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/billing")}><Plus className="mr-2 size-4" /> New sale</CommandItem>
          <CommandItem onSelect={() => go("/inventory")}><Package className="mr-2 size-4" /> Add product</CommandItem>
          <CommandItem onSelect={() => go("/reports")}><Receipt className="mr-2 size-4" /> Open reports</CommandItem>
          <CommandItem onSelect={() => go("/")}><LayoutDashboard className="mr-2 size-4" /> Go to dashboard</CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("/")}><LayoutDashboard className="mr-2 size-4" /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/billing")}><ScanBarcode className="mr-2 size-4" /> Billing</CommandItem>
          <CommandItem onSelect={() => go("/inventory")}><Package className="mr-2 size-4" /> Inventory</CommandItem>
          <CommandItem onSelect={() => go("/customers")}><Users className="mr-2 size-4" /> Customers</CommandItem>
          <CommandItem onSelect={() => go("/reports")}><BarChart3 className="mr-2 size-4" /> Reports</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings className="mr-2 size-4" /> Settings</CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => { setTheme("light"); setOpen(false); }}><Sun className="mr-2 size-4" /> Light theme</CommandItem>
          <CommandItem onSelect={() => { setTheme("dark"); setOpen(false); }}><Moon className="mr-2 size-4" /> Dark theme</CommandItem>
          <CommandItem onSelect={() => { setTheme("system"); setOpen(false); }}><Monitor className="mr-2 size-4" /> System theme</CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Categories">
          {categories.map((c) => (
            <CommandItem key={c} value={`category ${c}`} onSelect={() => go("/inventory")}>
              <Tag className="mr-2 size-4" /> {c}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Products">
          {products.slice(0, 10).map((p) => (
            <CommandItem
              key={p.id}
              value={`product ${p.name} ${p.sku} ${p.barcode} ${p.category}`}
              onSelect={() => { addToCart(p); go("/billing"); }}
            >
              <ScanBarcode className="mr-2 size-4" />
              <span className="mr-2">{p.emoji}</span>
              {p.name}
              <span className="ml-auto text-xs text-muted-foreground">{p.sku}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Customers">
          {customers.map((c) => (
            <CommandItem
              key={c.id}
              value={`customer ${c.name} ${c.mobile}`}
              onSelect={() => go("/customers")}
            >
              <Users className="mr-2 size-4" /> {c.name}
              <span className="ml-auto text-xs text-muted-foreground">{c.mobile}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Invoices">
          {invoices.map((inv) => (
            <CommandItem key={inv.id} value={`invoice ${inv.id}`} onSelect={() => go("/reports")}>
              <Receipt className="mr-2 size-4" /> {inv.id}
              <span className="ml-auto text-xs text-muted-foreground">{inv.date}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
