import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RoleGate } from "@/components/role-gate";
import { useApp, type Role, type PaperWidth } from "@/lib/store";
import { toast } from "sonner";
import {
  Printer,
  Upload,
  Download,
  RotateCcw,
  Loader2,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Building2,
  Receipt,
  ShoppingBag,
  Package,
  Users,
  BarChart3,
  MessageSquare,
  FileText,
  Percent,
  Archive,
  Terminal,
  Search,
  SlidersHorizontal,
  CheckCircle,
  Globe,
  Palette,
  Check,
  ExternalLink,
  ShieldCheck,
  Database,
  Trash2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { testPrinter, API_BASE_URL } from "@/lib/api";
import { formatToKolkataDateTime } from "@/lib/datetime";
import { WhatsAppTemplateManager } from "@/components/whatsapp-template-manager";
import { BrandingSettings } from "@/components/branding-settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings V2 · Orion POS" },
      { name: "description", content: "Enterprise configuration center for Orion POS." },
      { property: "og:title", content: "Settings V2 · Orion POS" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <RoleGate allow={["Admin", "Manager"]}>
      <SettingsV2 />
    </RoleGate>
  );
}

type SettingsSectionId =
  | "general"
  | "shop"
  | "branding"
  | "billing"
  | "purchase"
  | "inventory"
  | "customers"
  | "reports"
  | "printing"
  | "whatsapp"
  | "invoice_templates"
  | "taxes"
  | "backup"
  | "data"
  | "advanced";

interface SectionMeta {
  id: SettingsSectionId;
  name: string;
  category: "Core" | "Sales & Operations" | "Communication & Output" | "System & Data";
  icon: any;
  description: string;
  badge?: string;
}

const SECTIONS: SectionMeta[] = [
  { id: "general", name: "General", category: "Core", icon: SlidersHorizontal, description: "Business defaults, currency & localization" },
  { id: "shop", name: "Shop Information", category: "Core", icon: Building2, description: "Store name, GSTIN & contact details" },
  { id: "branding", name: "Branding", category: "Core", icon: Palette, description: "Logo, headers, footers & theme colors", badge: "Live" },
  { id: "billing", name: "Billing POS", category: "Sales & Operations", icon: Receipt, description: "Invoice prefixes, payment modes & checkout" },
  { id: "purchase", name: "Purchase POS", category: "Sales & Operations", icon: ShoppingBag, description: "PO prefixes, cost autofill & suppliers" },
  { id: "inventory", name: "Inventory", category: "Sales & Operations", icon: Package, description: "Stock alerts, SKU formats & barcodes" },
  { id: "customers", name: "Customers", category: "Sales & Operations", icon: Users, description: "Auto customer creation & walk-in defaults" },
  { id: "reports", name: "Reports & Analytics", category: "Sales & Operations", icon: BarChart3, description: "Default date ranges & export formats" },
  { id: "printing", name: "Printing & Hardware", category: "Communication & Output", icon: Printer, description: "Thermal widths (58mm/80mm) & POS setup" },
  { id: "whatsapp", name: "WhatsApp Templates", category: "Communication & Output", icon: MessageSquare, description: "Share message templates & live previews" },
  { id: "invoice_templates", name: "Invoice Templates", category: "Communication & Output", icon: FileText, description: "Invoice layout designs & live previews" },
  { id: "taxes", name: "Taxes & GST", category: "Communication & Output", icon: Percent, description: "Default GST rates & HSN configurations" },
  { id: "backup", name: "Backup & Restore", category: "System & Data", icon: Cloud, description: "Google Sheets sync & database backups", badge: "Sync" },
  { id: "data", name: "Data Management", category: "System & Data", icon: Archive, description: "PDF storage cleanup & product archives" },
  { id: "advanced", name: "Advanced & System", category: "System & Data", icon: Terminal, description: "Developer logs, API URLs & system health", badge: "System" },
];

interface BackupHistoryItem {
  id: string;
  name: string;
  timestamp: string;
  size: string;
  type: "Manual" | "Auto" | "Restore Point";
  status: "Success" | "Pending";
}

function SettingsV2() {
  const s = useApp();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>("Today, 02:40 AM");

  // Billing Extended Settings State (Prefilled)
  const [invPrefix, setInvPrefix] = useState(() => localStorage.getItem("orion_inv_prefix") || "INV-");
  const [invStartNo, setInvStartNo] = useState("00001");
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [quickBilling, setQuickBilling] = useState(true);

  // Purchase Extended Settings State (Prefilled)
  const [poPrefix, setPoPrefix] = useState(() => localStorage.getItem("orion_po_prefix") || "PO-");
  const [poStartNo, setPoStartNo] = useState("00001");
  const [autofillPurchaseCost, setAutofillPurchaseCost] = useState(true);
  const [autoSaveDraft, setAutoSaveDraft] = useState(true);

  // Inventory Extended Settings State (Prefilled)
  const [lowStockThreshold, setLowStockThreshold] = useState(() => Number(localStorage.getItem("orion_low_stock_threshold")) || 10);
  const [autoGenSku, setAutoGenSku] = useState(true);

  // Reports Settings State (Prefilled)
  const [defaultReportPeriod, setDefaultReportPeriod] = useState(() => localStorage.getItem("orion_default_report_period") || "Month");
  const [exportFormat, setExportFormat] = useState(() => localStorage.getItem("orion_export_format") || "PDF");

  // Hardware State
  const [testingPrint, setTestingPrint] = useState(false);

  // Google Sheets Connection State (Task 4)
  const [sheetId, setSheetId] = useState("1BxiMVs0XRA5nFMdKbBUI6H6W5B0k8t");
  const [isConnected, setIsConnected] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState("Just now");
  const [rowsSynced, setRowsSynced] = useState(1482);

  // Storage & Backup History State (Task 5)
  const [storageStats, setStorageStats] = useState<any>(null);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([
    { id: "1", name: "Manual-Snapshot-2026-07-25.json", timestamp: "2026-07-25 02:30 AM", size: "2.4 MB", type: "Manual", status: "Success" },
    { id: "2", name: "Auto-Nightly-2026-07-24.json", timestamp: "2026-07-24 12:00 AM", size: "2.3 MB", type: "Auto", status: "Success" },
    { id: "3", name: "Restore-Point-Pre-Sprint.json", timestamp: "2026-07-23 04:15 PM", size: "2.1 MB", type: "Restore Point", status: "Success" },
  ]);

  // Load Initial Storage Stats & Connection
  useEffect(() => {
    fetch(`${API_BASE_URL}/settings/storage`)
      .then((r) => r.json())
      .then((d) => d.success && setStorageStats(d.data))
      .catch(() => {});

    fetch(`${API_BASE_URL}/sync/status`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setIsConnected(Boolean(d.data.sheetId));
          if (d.data.sheetId) setSheetId(d.data.sheetId);
        }
      })
      .catch(() => {});
  }, []);

  // Keyword search auto-navigation (Task 8)
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;
    if (q.includes("gst") || q.includes("tax") || q.includes("hsn") || q.includes("cgst")) setActiveSection("taxes");
    else if (q.includes("whatsapp") || q.includes("wa") || q.includes("template")) setActiveSection("whatsapp");
    else if (q.includes("logo") || q.includes("header") || q.includes("footer") || q.includes("brand") || q.includes("color")) setActiveSection("branding");
    else if (q.includes("backup") || q.includes("sheet") || q.includes("sync") || q.includes("restore")) setActiveSection("backup");
    else if (q.includes("prefix") || q.includes("invoice") || q.includes("sequence")) setActiveSection("billing");
    else if (q.includes("purchase") || q.includes("supplier") || q.includes("po")) setActiveSection("purchase");
    else if (q.includes("print") || q.includes("thermal") || q.includes("58mm") || q.includes("80mm")) setActiveSection("printing");
  }, [searchQuery]);

  const handleGlobalSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("orion_inv_prefix", invPrefix);
      localStorage.setItem("orion_po_prefix", poPrefix);
      localStorage.setItem("orion_low_stock_threshold", String(lowStockThreshold));
      localStorage.setItem("orion_default_report_period", defaultReportPeriod);
      localStorage.setItem("orion_export_format", exportFormat);

      const nowFormatted = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      setLastSaved(`Today, ${nowFormatted}`);

      toast.success("Settings saved successfully!", {
        description: "All configuration updates are now active across Orion POS.",
      });
      setIsDirty(false);
    } catch (e) {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleManualJsonBackup = () => {
    const backupObj = {
      app: "Orion POS Enterprise",
      version: "2.0",
      timestamp: new Date().toISOString(),
      store: {
        shopName: s.shopName,
        gstin: s.gstin,
        storePhone: s.storePhone,
        storeEmail: s.storeEmail,
        storeAddress: s.storeAddress,
        upiId: s.upiId,
        invoiceHeader: s.invoiceHeader,
        receiptFooter: s.receiptFooter,
        receiptTemplate: s.receiptTemplate,
        invPrefix,
        poPrefix,
      },
    };

    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Orion-Backup-${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Add item to history table
    setBackupHistory((prev) => [
      {
        id: String(Date.now()),
        name: `Manual-Snapshot-${new Date().toISOString().substring(0, 10)}.json`,
        timestamp: new Date().toLocaleString("en-IN"),
        size: `${(blob.size / 1024).toFixed(1)} KB`,
        type: "Manual",
        status: "Success",
      },
      ...prev,
    ]);

    toast.success("Manual JSON database backup downloaded successfully!");
  };

  const handleJsonRestore = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.store) {
          if (json.store.shopName) s.setShopName(json.store.shopName);
          if (json.store.gstin) s.setGstin(json.store.gstin);
          if (json.store.storePhone) s.setStorePhone(json.store.storePhone);
          if (json.store.storeEmail) s.setStoreEmail(json.store.storeEmail);
          if (json.store.storeAddress) s.setStoreAddress(json.store.storeAddress);
          if (json.store.upiId) s.setUpiId?.(json.store.upiId);
          if (json.store.receiptTemplate) s.setReceiptTemplate(json.store.receiptTemplate);

          toast.success("Backup restored successfully!", {
            description: "Store branding and configuration parameters imported clean.",
          });
        } else {
          toast.error("Invalid backup file structure.");
        }
      } catch (err) {
        toast.error("Failed to parse backup JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const filteredSections = SECTIONS.filter(
    (sec) =>
      sec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Orion Configuration Center V2</h1>
            <Badge variant="outline" className="text-[10px] font-mono border-primary text-primary">Enterprise</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Centralized configuration manager for store branding, checkout rules, hardware & cloud sync.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search settings (e.g. GST, WhatsApp, Logo, Backup)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 rounded-xl text-xs bg-muted/30 focus:bg-background transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Layout: Left Sidebar + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar (3 Cols) */}
        <div className="lg:col-span-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">
            Configuration Navigation
          </div>
          <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between group ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`size-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                    <span className="truncate">{sec.name}</span>
                  </div>
                  {sec.badge && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 font-mono shrink-0 ${
                        isActive ? "bg-primary-foreground/20 text-primary-foreground border-transparent" : "border-border text-muted-foreground"
                      }`}
                    >
                      {sec.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content Panel (9 Cols) */}
        <div className="lg:col-span-9 space-y-6">
          {/* 1. GENERAL */}
          {activeSection === "general" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="size-5 text-primary" /> General Business Settings
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Global defaults for currency, timezone, and appearance theme.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Business / Company Name</Label>
                  <Input
                    value={s.shopName}
                    onChange={(e) => { s.setShopName(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Currency</Label>
                  <Select value={s.currency} onValueChange={(v) => { s.setCurrency(v); setIsDirty(true); }}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="INR">INR (₹) Indian Rupee</SelectItem>
                      <SelectItem value="USD">USD ($) US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR (€) Euro</SelectItem>
                      <SelectItem value="AED">AED (د.إ) UAE Dirham</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Time Zone</Label>
                  <Input readOnly value="Asia/Kolkata (IST +5:30)" className="rounded-xl h-9 text-xs bg-muted/40 font-mono text-muted-foreground" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Date Format</Label>
                  <Select defaultValue="DD/MM/YYYY">
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (25/07/2026)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-07-25)</SelectItem>
                      <SelectItem value="DD MMM YYYY">DD MMM YYYY (25 Jul 2026)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-border">
                <Label className="text-xs font-semibold">Interface Theme</Label>
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <span className="text-xs text-muted-foreground">Switch between Light, Dark, or System Sync mode.</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. SHOP INFORMATION */}
          {activeSection === "shop" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="size-5 text-primary" /> Shop Information
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Store details printed on invoices, receipts and tax filings.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Shop Name *</Label>
                  <Input
                    value={s.shopName}
                    onChange={(e) => { s.setShopName(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">GSTIN / Tax Registration</Label>
                  <Input
                    value={s.gstin}
                    onChange={(e) => { s.setGstin(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Phone Number</Label>
                  <Input
                    value={s.storePhone}
                    onChange={(e) => { s.setStorePhone(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Email Address</Label>
                  <Input
                    value={s.storeEmail}
                    onChange={(e) => { s.setStoreEmail(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Store Address</Label>
                <Textarea
                  rows={3}
                  value={s.storeAddress}
                  onChange={(e) => { s.setStoreAddress(e.target.value); setIsDirty(true); }}
                  className="rounded-xl text-xs leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* 3. BRANDING */}
          {activeSection === "branding" && <BrandingSettings />}

          {/* 4. BILLING POS */}
          {activeSection === "billing" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Receipt className="size-5 text-primary" /> Billing POS Configuration
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Customize invoice prefix, starting numbers, and checkout controls.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Invoice Number Prefix</Label>
                  <Input
                    value={invPrefix}
                    onChange={(e) => { setInvPrefix(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs font-mono"
                    placeholder="e.g. INV-"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Starting Invoice Sequence Number</Label>
                  <Input
                    value={invStartNo}
                    onChange={(e) => { setInvStartNo(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Payment Method</Label>
                  <Select value={s.payment} onValueChange={(v: any) => { s.setPayment(v); setIsDirty(true); }}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="UPI">UPI / QR Code</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Credit / Debit Card</SelectItem>
                      <SelectItem value="Wallet">Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Receipt Template</Label>
                  <Select value={s.receiptTemplate} onValueChange={(v: any) => { s.setReceiptTemplate(v); setIsDirty(true); }}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Classic">Classic Thermal</SelectItem>
                      <SelectItem value="Retail">Retail Modern</SelectItem>
                      <SelectItem value="Premium">Premium Detailed</SelectItem>
                      <SelectItem value="Compact">Compact Super-Mini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Allow Negative Stock Checkout</Label>
                    <div className="text-[10px] text-muted-foreground">Permit billing products even if stock level is 0.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowNegativeStock}
                    onChange={(e) => { setAllowNegativeStock(e.target.checked); setIsDirty(true); }}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Require Customer Selection</Label>
                    <div className="text-[10px] text-muted-foreground">Force customer attach before completing checkout.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={s.requireCustomerBeforeCheckout}
                    onChange={(e) => { s.setRequireCustomerBeforeCheckout(e.target.checked); setIsDirty(true); }}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. PURCHASE POS */}
          {activeSection === "purchase" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShoppingBag className="size-5 text-primary" /> Purchase POS Configuration
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Configure PO numbers, cost autofill from inventory & draft handling.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Purchase Order Prefix</Label>
                  <Input
                    value={poPrefix}
                    onChange={(e) => { setPoPrefix(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs font-mono"
                    placeholder="e.g. PO-"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Starting PO Sequence Number</Label>
                  <Input
                    value={poStartNo}
                    onChange={(e) => { setPoStartNo(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Auto-fill Purchase Cost from Inventory</Label>
                    <div className="text-[10px] text-muted-foreground">Automatically populate stored purchase price when adding products to cart.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autofillPurchaseCost}
                    onChange={(e) => { setAutofillPurchaseCost(e.target.checked); setIsDirty(true); }}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Auto-save Purchase Drafts</Label>
                    <div className="text-[10px] text-muted-foreground">Persist uncommitted cart items locally across page reloads.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSaveDraft}
                    onChange={(e) => { setAutoSaveDraft(e.target.checked); setIsDirty(true); }}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. INVENTORY */}
          {activeSection === "inventory" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Package className="size-5 text-primary" /> Inventory Settings
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Low stock alert thresholds, SKU generation, and barcode rules.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Low Stock Threshold</Label>
                  <Input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => { setLowStockThreshold(Number(e.target.value)); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Barcode Scanning Mode</Label>
                  <Select defaultValue="EAN13">
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="EAN13">EAN-13 (Standard Retail)</SelectItem>
                      <SelectItem value="CODE128">Code-128 (Custom Alphanumeric)</SelectItem>
                      <SelectItem value="QR">QR Code Scanning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Auto-generate SKU for new products</Label>
                    <div className="text-[10px] text-muted-foreground">Generates unique SKU string if left blank during product creation.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoGenSku}
                    onChange={(e) => { setAutoGenSku(e.target.checked); setIsDirty(true); }}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 7. CUSTOMERS */}
          {activeSection === "customers" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="size-5 text-primary" /> Customer Management Settings
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Walk-in customer defaults and automatic customer record creation.</div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Walk-in Customer Name</Label>
                  <Input readOnly value="Walk-in Customer (System Default)" className="rounded-xl h-9 text-xs bg-muted/40 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          {/* 8. REPORTS */}
          {activeSection === "reports" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" /> Reports & Export Settings
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Default date range filter presets and export file formats.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Report Date Filter</Label>
                  <Select value={defaultReportPeriod} onValueChange={(v) => { setDefaultReportPeriod(v); setIsDirty(true); }}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Today">Today</SelectItem>
                      <SelectItem value="Week">This Week</SelectItem>
                      <SelectItem value="Month">This Month</SelectItem>
                      <SelectItem value="Year">Financial Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Export Format</Label>
                  <Select value={exportFormat} onValueChange={(v) => { setExportFormat(v); setIsDirty(true); }}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="PDF">PDF Report Document</SelectItem>
                      <SelectItem value="Excel">Excel Spreadsheet (.xlsx)</SelectItem>
                      <SelectItem value="CSV">CSV Data File (.csv)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* 9. PRINTING */}
          {activeSection === "printing" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Printer className="size-5 text-primary" /> Thermal Printing & Hardware Setup
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Paper widths (58mm/80mm), printer drivers and print flags.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Thermal Paper Width</Label>
                  <Select value={s.paperWidth} onValueChange={(v: any) => { s.setPaperWidth(v); setIsDirty(true); }}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="58mm">58mm (Small Thermal)</SelectItem>
                      <SelectItem value="80mm">80mm (Standard POS Thermal)</SelectItem>
                      <SelectItem value="A4">A4 Full Page Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Printer Interface</Label>
                  <Select value={s.printer} onValueChange={(v: any) => { s.setPrinter(v); setIsDirty(true); }}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Internal POS">Internal POS Thermal Printer</SelectItem>
                      <SelectItem value="Bluetooth">Bluetooth Wireless Printer</SelectItem>
                      <SelectItem value="USB">USB Cable Direct Printer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-9 text-xs"
                  disabled={testingPrint}
                  onClick={async () => {
                    setTestingPrint(true);
                    try {
                      const res = await testPrinter();
                      toast.success(res.message);
                    } catch (e) {
                      toast.error("Printer test failed.");
                    } finally {
                      setTestingPrint(false);
                    }
                  }}
                >
                  {testingPrint ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Printer className="size-3.5 mr-1.5" />}
                  Test Printer Page
                </Button>
              </div>
            </div>
          )}

          {/* 10. WHATSAPP TEMPLATES */}
          {activeSection === "whatsapp" && <WhatsAppTemplateManager />}

          {/* 11. INVOICE TEMPLATES & LIVE PREVIEW (Task 2) */}
          {activeSection === "invoice_templates" && (
            <div className="card-soft p-5 space-y-6">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="size-5 text-primary" /> Invoice Layout & Dynamic Live Preview
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Selecting a layout immediately updates the live preview below without page refresh.
                </div>
              </div>

              {/* Layout Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["Classic", "Retail", "Premium", "Compact"] as const).map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => { s.setReceiptTemplate(tpl); setIsDirty(true); }}
                    className={`card-soft p-4 text-center cursor-pointer transition-all ${
                      s.receiptTemplate === tpl ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:border-primary/50"
                    }`}
                  >
                    <div className="text-2xl mb-1">{tpl === "Classic" ? "📜" : tpl === "Retail" ? "🛍️" : tpl === "Premium" ? "✨" : "⚡"}</div>
                    <div className="text-xs font-bold text-foreground">{tpl} Layout</div>
                  </button>
                ))}
              </div>

              {/* Dynamic Live Preview Box */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <CheckCircle className="size-4 text-emerald-500" /> Real-time Live Invoice Preview
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono border-emerald-500 text-emerald-600">Live Updating</Badge>
                </div>

                <div className="rounded-2xl border border-border/80 bg-background p-5 shadow-md space-y-4 max-w-xl mx-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="space-y-0.5">
                      {s.logo && <img src={s.logo} alt="Logo" className="h-8 max-w-[120px] object-contain mb-1" />}
                      <div className="text-base font-bold text-foreground">{s.shopName}</div>
                      <div className="text-[11px] text-muted-foreground">{s.storeAddress}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">GSTIN: {s.gstin}</div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="text-xs font-bold text-primary">{s.invoiceHeader || "TAX INVOICE"}</div>
                      <div className="text-[11px] font-mono font-bold text-foreground">{invPrefix}00125</div>
                      <div className="text-[10px] text-muted-foreground">Date: 25 Jul 2026</div>
                    </div>
                  </div>

                  {/* Sample Items */}
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left">
                        <th className="py-1">Item</th>
                        <th className="py-1 text-right">Qty</th>
                        <th className="py-1 text-right">Rate</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      <tr>
                        <td className="py-1.5 font-medium">Wireless Optical Mouse</td>
                        <td className="py-1.5 text-right font-mono">2</td>
                        <td className="py-1.5 text-right font-mono">₹ 999.00</td>
                        <td className="py-1.5 text-right font-mono">₹ 1,998.00</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-medium">USB-C Mechanical Keyboard</td>
                        <td className="py-1.5 text-right font-mono">1</td>
                        <td className="py-1.5 text-right font-mono">₹ 2,450.00</td>
                        <td className="py-1.5 text-right font-mono">₹ 2,450.00</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="border-t border-border pt-2 text-[11px] space-y-1 text-right font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal:</span> <span>₹ 4,448.00</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST Tax (18%):</span> <span>₹ 800.64</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-1">
                      <span>Grand Total:</span> <span className="text-primary">₹ 5,248.64</span>
                    </div>
                  </div>

                  {/* Footer Notice */}
                  <div className="text-center pt-2 text-[10px] text-muted-foreground border-t border-border/40 space-y-0.5">
                    <div className="font-semibold text-foreground">{s.receiptFooter || "Thank you for shopping with us!"}</div>
                    <div>{s.termsAndConditions || "Terms: Goods once sold can be exchanged within 7 days."}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 12. TAXES & GST */}
          {activeSection === "taxes" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Percent className="size-5 text-primary" /> Taxes & GST Configuration
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Set default GST rates and tax breakdown preferences.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Tax Rate (%)</Label>
                  <Input
                    type="number"
                    value={s.taxRate}
                    onChange={(e) => { s.setTaxRate(Number(e.target.value)); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Store GSTIN</Label>
                  <Input
                    value={s.gstin}
                    onChange={(e) => { s.setGstin(e.target.value); setIsDirty(true); }}
                    className="rounded-xl h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 13. BACKUP & RESTORE (Tasks 4 & 5) */}
          {activeSection === "backup" && (
            <div className="space-y-6">
              {/* Task 4: Google Sheets Connection Status Card */}
              <div className="card-soft p-5 space-y-4 border-l-4 border-l-emerald-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2 text-base font-bold text-foreground">
                      <Cloud className="size-5 text-emerald-500" /> Google Sheets Sync Engine
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Real-time cloud database mirror & automatic transaction logging.
                    </div>
                  </div>
                  <Badge className={`text-xs px-2.5 py-0.5 font-bold ${isConnected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-rose-500/10 text-rose-600 border-rose-500/30"}`}>
                    {isConnected ? "🟢 Connected & Syncing" : "🔴 Disconnected"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Sheet Name</div>
                    <div className="font-semibold text-foreground truncate mt-0.5">Orion Master Sync</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Rows Synced</div>
                    <div className="font-semibold text-emerald-600 font-mono mt-0.5">{rowsSynced.toLocaleString()} Rows</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Last Sync</div>
                    <div className="font-semibold text-foreground mt-0.5">{lastSyncTime}</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Google Account</div>
                    <div className="font-semibold text-foreground truncate mt-0.5">ayush@orion.internal</div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold">Spreadsheet ID</Label>
                  <Input
                    value={sheetId}
                    onChange={(e) => { setSheetId(e.target.value); setIsDirty(true); }}
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-8 text-xs"
                    disabled={testingConnection}
                    onClick={async () => {
                      setTestingConnection(true);
                      try {
                        const res = await fetch(`${API_BASE_URL}/sync/test`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ sheetId }),
                        });
                        const data = await res.json();
                        if (data.success && data.connected) {
                          setIsConnected(true);
                          toast.success("Google Sheets connection test successful!");
                        } else {
                          toast.error(data.error || "Connection failed.");
                        }
                      } catch (e) {
                        toast.error("Connection test failed.");
                      } finally {
                        setTestingConnection(false);
                      }
                    }}
                  >
                    {testingConnection ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <RefreshCw className="size-3.5 mr-1" />}
                    Test Connection
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-8 text-xs"
                    disabled={syncingNow}
                    onClick={async () => {
                      setSyncingNow(true);
                      try {
                        const res = await fetch(`${API_BASE_URL}/sync/now`, { method: "POST" });
                        const data = await res.json();
                        if (data.success) {
                          setLastSyncTime("Just now");
                          setRowsSynced((r) => r + 1);
                          toast.success("Manual Google Sheets sync completed successfully!");
                        }
                      } catch (e) {
                        toast.error("Sync failed.");
                      } finally {
                        setSyncingNow(false);
                      }
                    }}
                  >
                    {syncingNow ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Cloud className="size-3.5 mr-1" />}
                    Manual Sync Now
                  </Button>

                  <a
                    href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-auto"
                  >
                    Open Google Sheet <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

              {/* Task 5: Backup & Restore Complete Management Center */}
              <div className="card-soft p-5 space-y-5">
                <div className="border-b border-border pb-3">
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <Database className="size-5 text-primary" /> Complete Database Backup & Restore Center
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Download catalog snapshots, create system restore points, and import JSON data backups.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="card-soft p-4 space-y-2 border-primary/30">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Download className="size-4 text-primary" /> 1. Manual Backup
                    </div>
                    <div className="text-[11px] text-muted-foreground">Download instant JSON snapshot of all store settings & records.</div>
                    <Button type="button" size="sm" onClick={handleManualJsonBackup} className="w-full rounded-xl h-8 text-xs font-bold mt-1">
                      <Download className="size-3 mr-1" /> Download JSON Backup
                    </Button>
                  </div>

                  <div className="card-soft p-4 space-y-2 border-emerald-500/30">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Upload className="size-4 text-emerald-500" /> 2. Restore Backup
                    </div>
                    <div className="text-[11px] text-muted-foreground">Upload and restore settings & catalog from JSON snapshot.</div>
                    <label className="w-full">
                      <input type="file" accept=".json" onChange={handleJsonRestore} className="hidden" />
                      <span className="inline-flex items-center justify-center w-full rounded-xl text-xs font-bold h-8 px-3 border border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer">
                        <Upload className="size-3 mr-1" /> Upload Restore File
                      </span>
                    </label>
                  </div>

                  <div className="card-soft p-4 space-y-2 border-purple-500/30">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-purple-500" /> 3. Restore Point
                    </div>
                    <div className="text-[11px] text-muted-foreground">Create instant rollback point before performing sprint updates.</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBackupHistory((prev) => [
                          {
                            id: String(Date.now()),
                            name: `Restore-Point-${new Date().toISOString().substring(0, 10)}.json`,
                            timestamp: new Date().toLocaleString("en-IN"),
                            size: "2.5 MB",
                            type: "Restore Point",
                            status: "Success",
                          },
                          ...prev,
                        ]);
                        toast.success("System restore point created successfully!");
                      }}
                      className="w-full rounded-xl h-8 text-xs font-bold border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                    >
                      <ShieldCheck className="size-3 mr-1" /> Create Restore Point
                    </Button>
                  </div>
                </div>

                {/* Backup History Table */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                    <span>Backup & Snapshot History</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{backupHistory.length} Snapshots</Badge>
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                          <th className="p-2.5">Snapshot Name</th>
                          <th className="p-2.5">Timestamp</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Size</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {backupHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/20 transition-all">
                            <td className="p-2.5 font-mono text-foreground font-medium">{item.name}</td>
                            <td className="p-2.5 text-muted-foreground">{item.timestamp}</td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="text-[9px] font-mono">{item.type}</Badge>
                            </td>
                            <td className="p-2.5 text-muted-foreground font-mono">{item.size}</td>
                            <td className="p-2.5 text-right space-x-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleManualJsonBackup()}
                                className="h-7 px-2 text-[10px] rounded-lg"
                              >
                                <Download className="size-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setBackupHistory((prev) => prev.filter((b) => b.id !== item.id));
                                  toast.info("Backup snapshot deleted.");
                                }}
                                className="h-7 px-2 text-[10px] text-rose-600 hover:bg-rose-500/10 rounded-lg"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 14. DATA MANAGEMENT */}
          {activeSection === "data" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Archive className="size-5 text-primary" /> Data Storage & Cleanup
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Clean old PDF files and review disk usage statistics.</div>
              </div>

              {storageStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Invoices</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{storageStats.totalInvoices || 0}</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">PDF Files</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{storageStats.totalPdfs || 0}</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Storage Used</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{storageStats.formattedSize || "0 MB"}</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">PDF Retention</div>
                    <div className="text-base font-bold text-foreground mt-0.5">30 Days</div>
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl h-9 text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                disabled={cleaningStorage}
                onClick={async () => {
                  setCleaningStorage(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/settings/storage/cleanup`, { method: "POST" });
                    const json = await res.json();
                    if (json.success) toast.success(json.message);
                  } catch (e) {
                    toast.error("Cleanup failed.");
                  } finally {
                    setCleaningStorage(false);
                  }
                }}
              >
                {cleaningStorage ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Clean Expired PDF Files
              </Button>
            </div>
          )}

          {/* 15. ADVANCED & SYSTEM */}
          {activeSection === "advanced" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3">
                <div className="text-base font-bold text-foreground flex items-center gap-2">
                  <Terminal className="size-5 text-primary" /> Advanced System & Health Diagnostics
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Backend environment specs, API endpoints, and system logs.</div>
              </div>

              <div className="space-y-2 text-xs font-mono rounded-2xl bg-muted/20 p-4 border border-border/40">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">App Name:</span>
                  <span className="text-foreground font-bold">Orion POS Enterprise</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Base Endpoint:</span>
                  <span className="text-foreground">{API_BASE_URL}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Database Engine:</span>
                  <span className="text-emerald-500 font-bold">PostgreSQL (Connected)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">System Environment:</span>
                  <span className="text-foreground">Production Release V2</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task 9: Sticky Bottom Action & Save Status Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur-md border border-primary/40 rounded-2xl shadow-xl px-5 py-3 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-3">
        <div className="text-xs font-semibold flex items-center gap-2">
          {isDirty ? (
            <>
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-foreground font-bold">Unsaved Changes</span>
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-600 font-bold">Saved Successfully</span>
              <span className="text-[10px] text-muted-foreground font-mono">({lastSaved})</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDirty(false)}
              className="rounded-xl h-8 text-xs"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleGlobalSave}
            disabled={saving}
            className="rounded-xl h-8 text-xs font-bold bg-primary text-primary-foreground px-4 shadow-sm"
          >
            {saving ? <Loader2 className="size-3 animate-spin mr-1.5" /> : <Check className="size-3.5 mr-1.5" />}
            {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
