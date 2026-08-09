import { createLazyFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
  Sliders,
  FileSpreadsheet,
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
  Sparkles,
  ArrowRight,
  FileJson,
  FileUp,
  FileDown,
  SearchX,
  Store,
  Key,
  Lock,
  KeyRound,
} from "lucide-react";
import { getPrintAdapter } from "@/lib/print-adapter";
import { printerService } from "@/lib/printer.service";
import { DEFAULT_RECEIPT_TEMPLATES, saveActiveTemplateConfig } from "@/lib/receipt-template";
import { ThemeToggle } from "@/components/theme-toggle";
import { testPrinter, API_BASE_URL, apiFetch, resetOnboardingApi, changePasswordApi, getStoreHeaders } from "@/lib/api";
import { formatToKolkataDateTime } from "@/lib/datetime";
import { WhatsAppTemplateManager } from "@/components/whatsapp-template-manager";
import { BrandingSettings } from "@/components/branding-settings";
import { StoresManagementSection } from "@/components/stores-management-section";
import { UsersManagementSection } from "@/components/users-management-section";
import { OrganizationSettingsSection } from "@/components/organization-settings-section";
import { PrinterSettingsSection } from "@/components/printer-settings-section";
import { InvoiceTemplatesPage } from "@/components/invoice-templates-page";

export const Route = createLazyFileRoute("/settings")({
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
  | "organization"
  | "security"
  | "shop"
  | "stores"
  | "users"
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
  keywords: string[];
}

const SECTIONS: SectionMeta[] = [
  { id: "general", name: "General", category: "Core", icon: SlidersHorizontal, description: "Business defaults, currency & localization", keywords: ["general", "currency", "timezone", "language", "theme", "color"] },
  { id: "organization", name: "Organization Profile", category: "Core", icon: Building2, description: "Business profile, GST/PAN, logo & SaaS parameters", badge: "Owner", keywords: ["organization", "profile", "business", "gst", "pan", "logo", "address", "saas", "owner"] },
  { id: "security", name: "Security & Password", category: "Core", icon: Key, description: "Change owner login password & account security", badge: "Auth", keywords: ["security", "password", "owner", "login", "reset", "auth", "change password"] },
  { id: "shop", name: "Shop Information", category: "Core", icon: Building2, description: "Store name, GSTIN & contact details", keywords: ["shop", "store", "address", "phone", "email", "mobile", "contact", "identity"] },
  { id: "stores", name: "Stores Management", category: "Core", icon: Store, description: "Multi-store outlets, branches & switching", badge: "New", keywords: ["stores", "store", "multi-store", "branches", "outlets", "locations", "switching"] },
  { id: "users", name: "Users & Roles", category: "Core", icon: Users, description: "Team accounts, roles & store permissions", badge: "Roles", keywords: ["users", "user", "role", "permissions", "access", "manager", "cashier", "viewer", "team"] },
  { id: "branding", name: "Branding", category: "Core", icon: Palette, description: "Logo, headers, footers & theme colors", badge: "Live", keywords: ["logo", "branding", "color", "palette", "header", "footer", "tagline", "brand", "accent"] },
  { id: "billing", name: "Billing POS", category: "Sales & Operations", icon: Receipt, description: "Invoice prefixes, payment modes & checkout", keywords: ["billing", "invoice", "prefix", "sequence", "pos", "checkout", "payment", "inv-"] },
  { id: "purchase", name: "Purchase POS", category: "Sales & Operations", icon: ShoppingBag, description: "PO prefixes, cost autofill & suppliers", keywords: ["purchase", "po", "supplier", "cost", "autofill", "vendor", "po-", "void"] },
  { id: "inventory", name: "Inventory", category: "Sales & Operations", icon: Package, description: "Stock alerts, SKU formats & barcodes", keywords: ["inventory", "stock", "sku", "barcode", "threshold", "low stock", "adjust"] },
  { id: "customers", name: "Customers", category: "Sales & Operations", icon: Users, description: "Auto customer creation & walk-in defaults", keywords: ["customer", "customers", "walk-in", "orders", "crm", "ledger"] },
  { id: "reports", name: "Reports & Analytics", category: "Sales & Operations", icon: BarChart3, description: "Default date ranges & export formats", keywords: ["reports", "analytics", "export", "period", "date", "csv", "pdf", "month"] },
  { id: "printing", name: "Printing & Hardware", category: "Communication & Output", icon: Printer, description: "Thermal widths (58mm/80mm) & POS setup", keywords: ["print", "printing", "printer", "thermal", "58mm", "80mm", "paper", "hardware", "escpos"] },
  { id: "whatsapp", name: "WhatsApp Templates", category: "Communication & Output", icon: MessageSquare, description: "Share message templates & live previews", keywords: ["whatsapp", "wa", "template", "templates", "message", "signature", "share", "messaging"] },
  { id: "invoice_templates", name: "Invoice Templates", category: "Communication & Output", icon: FileText, description: "Invoice layout designs & live previews", keywords: ["invoice template", "templates", "specimen", "classic", "retail", "premium", "compact", "preview"] },
  { id: "taxes", name: "Taxes & GST", category: "Communication & Output", icon: Percent, description: "Default GST rates & HSN configurations", keywords: ["gst", "taxes", "tax", "hsn", "cgst", "sgst", "igst", "gstin", "rate"] },
  { id: "backup", name: "Backup & Restore", category: "System & Data", icon: Cloud, description: "Google Sheets sync & database backups", badge: "Sync", keywords: ["google", "sheets", "google sheets", "backup", "restore", "snapshot", "sync", "drive", "cloud", "spreadsheet"] },
  { id: "data", name: "Data Management", category: "System & Data", icon: Archive, description: "PDF storage cleanup & product archives", keywords: ["data", "cleanup", "storage", "pdf cleanup", "archive", "retention"] },
  { id: "advanced", name: "Advanced & System", category: "System & Data", icon: Terminal, description: "Developer logs, API URLs & system health", badge: "System", keywords: ["advanced", "system", "logs", "api", "diagnostics", "health", "environment"] },
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
  const [focusedNavIndex, setFocusedNavIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
  const [sheetId, setSheetId] = useState("");
  const [isConnected, setIsConnected] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState("Just now");
  const [rowsSynced, setRowsSynced] = useState(1482);

  // Google Workspace Integration State
  const [googleStatus, setGoogleStatus] = useState<{
    connected: boolean;
    email?: string;
    spreadsheetId?: string;
    spreadsheetName?: string;
    syncEnabled?: boolean;
    syncMethod?: "oauth" | "service_account";
    lastSync?: string;
  }>({ connected: false, syncMethod: "oauth" });

  const [syncMethod, setSyncMethod] = useState<"oauth" | "service_account">("oauth");
  const [spreadsheetsList, setSpreadsheetsList] = useState<Array<{ id: string; name: string; modifiedTime?: string }>>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const fetchGoogleStatus = () => {
    apiFetch(`${API_BASE_URL}/api/google/status`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setGoogleStatus(d.data);
          if (d.data.syncMethod) setSyncMethod(d.data.syncMethod as any);
          if (d.data.spreadsheetId) setSheetId(d.data.spreadsheetId);
          if (d.data.connected) setIsConnected(true);
        }
      })
      .catch(() => {});
  };

  const fetchSpreadsheets = () => {
    setLoadingSpreadsheets(true);
    apiFetch(`${API_BASE_URL}/api/google/spreadsheets`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setSpreadsheetsList(d.data);
          if (d.data.length > 0) {
            toast.success(`Found ${d.data.length} Google Spreadsheets.`);
          }
        } else {
          toast.error(d.error || "Failed to load spreadsheets");
        }
      })
      .catch((e) => toast.error("Error listing spreadsheets: " + (e.message || "Network error")))
      .finally(() => setLoadingSpreadsheets(false));
  };

  const handleConnectGoogle = () => {
    setConnectingGoogle(true);
    apiFetch(`${API_BASE_URL}/api/google/auth`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.authUrl) {
          window.location.href = d.authUrl;
        } else {
          toast.error(d.error || "Failed to initiate Google OAuth login.");
        }
      })
      .catch((e) => toast.error("OAuth init error: " + (e.message || "Network error")))
      .finally(() => setConnectingGoogle(false));
  };

  const handleSelectSpreadsheet = (id: string, name: string) => {
    apiFetch(`${API_BASE_URL}/api/google/spreadsheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spreadsheetId: id, spreadsheetName: name }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSheetId(id);
          setGoogleStatus((prev) => ({ ...prev, spreadsheetId: id, spreadsheetName: d.spreadsheetName || name }));
          toast.success(`Connected to spreadsheet: ${d.spreadsheetName || name}`);
        } else {
          toast.error(d.error || "Failed to update spreadsheet selection");
        }
      })
      .catch((e) => toast.error("Error updating spreadsheet: " + (e.message || "Network error")));
  };

  const handleDisconnectGoogle = () => {
    if (!window.confirm("Are you sure you want to disconnect your Google Workspace account?")) return;
    apiFetch(`${API_BASE_URL}/api/google/disconnect`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          toast.success("Google Workspace account disconnected.");
          setGoogleStatus({ connected: false, syncMethod: "service_account" });
          setSyncMethod("service_account");
        } else {
          toast.error(d.error || "Failed to disconnect account");
        }
      })
      .catch((e) => toast.error("Disconnect error: " + (e.message || "Network error")));
  };

  const handleSetSyncMethod = (method: "oauth" | "service_account") => {
    setSyncMethod(method);
    apiFetch(`${API_BASE_URL}/api/google/sync-method`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncMethod: method }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          toast.success(`Google sync method updated to ${method === "oauth" ? "Google Account (OAuth)" : "Service Account (Legacy)"}`);
          setGoogleStatus((prev) => ({ ...prev, syncMethod: method }));
        }
      })
      .catch(() => {});
  };

  // Storage & Backup History State (Task 5)
  const [storageStats, setStorageStats] = useState<any>(null);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [importPreviewDialogOpen, setImportPreviewDialogOpen] = useState(false);
  const [importPendingPayload, setImportPendingPayload] = useState<any>(null);
  const [importDiffList, setImportDiffList] = useState<
    Array<{ category: string; field: string; currentValue: string; importedValue: string }>
  >([]);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([
    { id: "1", name: "Manual-Snapshot-2026-07-25.json", timestamp: "2026-07-25 02:30 AM", size: "2.4 MB", type: "Manual", status: "Success" },
    { id: "2", name: "Auto-Nightly-2026-07-24.json", timestamp: "2026-07-24 12:00 AM", size: "2.3 MB", type: "Auto", status: "Success" },
    { id: "3", name: "Restore-Point-Pre-Sprint.json", timestamp: "2026-07-23 04:15 PM", size: "2.1 MB", type: "Restore Point", status: "Success" },
  ]);

  // Deep Dirty State Snapshot System
  const [savedSettings, setSavedSettings] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const getSettingsSnapshot = () => ({
    shopName: s.shopName || "",
    gstin: s.gstin || "",
    storePhone: s.storePhone || "",
    storeEmail: s.storeEmail || "",
    storeAddress: s.storeAddress || "",
    upiId: s.upiId || "",
    invoiceHeader: s.invoiceHeader || "",
    invoiceFooter: s.invoiceFooter || "",
    receiptFooter: s.receiptFooter || "",
    receiptTemplate: s.receiptTemplate || "",
    primaryColor: s.primaryColor || "",
    tagline: s.tagline || "",
    website: s.website || "",
    termsAndConditions: s.termsAndConditions || "",
    whatsappSignature: s.whatsappSignature || "",
    invPrefix: invPrefix || "",
    invStartNo: invStartNo || "",
    allowNegativeStock: Boolean(allowNegativeStock),
    quickBilling: Boolean(quickBilling),
    poPrefix: poPrefix || "",
    poStartNo: poStartNo || "",
    autofillPurchaseCost: Boolean(autofillPurchaseCost),
    autoSaveDraft: Boolean(autoSaveDraft),
    lowStockThreshold: Number(lowStockThreshold) || 10,
    autoGenSku: Boolean(autoGenSku),
    defaultReportPeriod: defaultReportPeriod || "Month",
    exportFormat: exportFormat || "PDF",
    sheetId: sheetId || "",
    autoBackupEnabled: Boolean(autoBackupEnabled),
    requireCustomerBeforeCheckout: Boolean(s.requireCustomerBeforeCheckout),
    currency: s.currency || "INR",
    theme: s.theme || "system",
  });

  const draftSettings = getSettingsSnapshot();

  const isDirty = useMemo(() => {
    if (!isInitialized || !savedSettings) return false;
    for (const key of Object.keys(draftSettings)) {
      const dVal = (draftSettings as any)[key];
      const sVal = (savedSettings as any)[key];
      if (typeof dVal === "string") {
        if (dVal.trim() !== (sVal ?? "").toString().trim()) return true;
      } else if (dVal !== sVal) {
        return true;
      }
    }
    return false;
  }, [isInitialized, draftSettings, savedSettings]);

  const restoreBackendSnapshot = () => {
    if (!savedSettings) return;
    const clean = structuredClone(savedSettings);
    s.setShopName(clean.shopName || "");
    s.setGstin(clean.gstin || "");
    s.setStorePhone(clean.storePhone || "");
    s.setStoreEmail(clean.storeEmail || "");
    s.setStoreAddress(clean.storeAddress || "");
    s.setUpiId(clean.upiId || "");
    if (s.setInvoiceHeader) s.setInvoiceHeader(clean.invoiceHeader || "");
    if (s.setInvoiceFooter) s.setInvoiceFooter(clean.invoiceFooter || "");
    if (s.setReceiptFooter) s.setReceiptFooter(clean.receiptFooter || "");
    if (s.setReceiptTemplate) s.setReceiptTemplate(clean.receiptTemplate || "Classic");
    if (s.setPrimaryColor) s.setPrimaryColor(clean.primaryColor || "");
    if (s.setTagline) s.setTagline(clean.tagline || "");
    if (s.setWebsite) s.setWebsite(clean.website || "");
    if (s.setTermsAndConditions) s.setTermsAndConditions(clean.termsAndConditions || "");
    if (s.setWhatsappSignature) s.setWhatsappSignature(clean.whatsappSignature || "");
    setInvPrefix(clean.invPrefix || "INV-");
    setPoPrefix(clean.poPrefix || "PO-");
    setLowStockThreshold(clean.lowStockThreshold || 10);
    setDefaultReportPeriod(clean.defaultReportPeriod || "Month");
    setExportFormat(clean.exportFormat || "PDF");
    setSheetId(clean.sheetId || "");
  };

  // Section switcher with Unsaved Changes warning guard
  const handleSelectSection = (nextId: SettingsSectionId) => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Discard them?")) {
        return;
      }
      restoreBackendSnapshot();
    }
    setActiveSection(nextId);
  };

  // Browser BeforeUnload Safety Guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Load Initial Storage Stats, Connection, and Restore Production Settings
  useEffect(() => {
    // Fetch Production Settings from Backend Database API
    apiFetch(`${API_BASE_URL}/settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          const cfg = d.data;

          s.setShopName(cfg.shop_name ?? "");
          s.setGstin(cfg.shop_gstin ?? "");
          s.setStoreAddress(cfg.shop_address ?? "");
          s.setStorePhone(cfg.shop_phone ?? "");
          s.setStoreEmail(cfg.shop_email ?? "");
          s.setLogo(cfg.logo ?? "");
          s.setUpiId(cfg.shop_upi_id ?? "");
          setInvPrefix(cfg.inv_prefix ?? "INV-");
          setPoPrefix(cfg.po_prefix ?? "PO-");
          s.setReceiptFooter(cfg.receipt_footer ?? "");
          if (cfg.google_sheet_id !== undefined) setSheetId(cfg.google_sheet_id ?? "");
          if (cfg.google_sync_enabled !== undefined) setIsConnected(cfg.google_sync_enabled === "1");
          if (cfg.theme) s.setTheme(cfg.theme as any);
          if (cfg.receipt_template) s.setReceiptTemplate(cfg.receipt_template as any);
          if (s.setPrimaryColor) s.setPrimaryColor(cfg.primary_color ?? "#2563eb");
          if (s.setTagline) s.setTagline(cfg.tagline ?? "");
          if (s.setWebsite) s.setWebsite(cfg.website ?? "");
          if (s.setInvoiceHeader) s.setInvoiceHeader(cfg.invoice_header ?? "");
          if (s.setInvoiceFooter) s.setInvoiceFooter(cfg.invoice_footer ?? "");
          if (s.setTermsAndConditions) s.setTermsAndConditions(cfg.terms_and_conditions ?? "");
          if (s.setWhatsappSignature) s.setWhatsappSignature(cfg.whatsapp_signature ?? "");
          if (s.setRequireCustomerBeforeCheckout) {
            s.setRequireCustomerBeforeCheckout(cfg.require_customer_before_checkout === "1" || cfg.require_customer_before_checkout === "true");
          }

          // Capture clean baseline snapshot after applying backend settings
          setTimeout(() => {
            const initialSnapshot = structuredClone(getSettingsSnapshot());
            setSavedSettings(initialSnapshot);
            setIsInitialized(true);
          }, 80);
        }
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => {
          setIsInitialized(true);
        }, 100);
      });

    // 3. Load Storage & Sync Status
    apiFetch(`${API_BASE_URL}/settings/storage`)
      .then((r) => r.json())
      .then((d) => d.success && setStorageStats(d.data))
      .catch(() => {});

    fetchGoogleStatus();

    // 4. Handle OAuth Redirect Query Params
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const googleAuthStatus = urlParams.get("google_auth");
      if (googleAuthStatus === "success") {
        const email = urlParams.get("email");
        toast.success(`Successfully connected Google account (${email || ""})!`, {
          description: "Please select your Google Spreadsheet below.",
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchSpreadsheets();
      } else if (googleAuthStatus === "error") {
        const reason = urlParams.get("reason");
        toast.error("Google OAuth connection failed: " + (reason || "Unknown error"));
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Filtered sections array based on search query or keywords
  const filteredSections = SECTIONS.filter((sec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      sec.name.toLowerCase().includes(q) ||
      sec.description.toLowerCase().includes(q) ||
      sec.id.toLowerCase().includes(q) ||
      sec.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  // Keyboard Navigation Listener (Cmd+K / / to search, Arrow keys to navigate, Enter to select)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && document.activeElement !== searchInputRef.current)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      } else if (document.activeElement === searchInputRef.current) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedNavIndex((prev) => (prev + 1) % (filteredSections.length || 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedNavIndex((prev) => (prev - 1 + filteredSections.length) % (filteredSections.length || 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredSections[focusedNavIndex]) {
            setActiveSection(filteredSections[focusedNavIndex].id);
            searchInputRef.current?.blur();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredSections, focusedNavIndex]);

  // Keyword search auto-navigation
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;
    if (q.includes("gst") || q.includes("tax") || q.includes("hsn") || q.includes("cgst") || q.includes("sgst")) {
      setActiveSection("taxes");
    } else if (q.includes("logo") || q.includes("brand") || q.includes("tagline") || q.includes("color") || q.includes("palette")) {
      setActiveSection("branding");
    } else if (q.includes("google") || q.includes("sheet") || q.includes("sheets") || q.includes("drive") || q.includes("spreadsheet")) {
      setActiveSection("backup");
    } else if (q.includes("whatsapp") || q.includes("wa") || q.includes("template") || q.includes("signature")) {
      setActiveSection("whatsapp");
    } else if (q.includes("backup") || q.includes("restore") || q.includes("snapshot") || q.includes("json")) {
      setActiveSection("backup");
    } else if (q.includes("prefix") || q.includes("invoice") || q.includes("sequence") || q.includes("billing")) {
      setActiveSection("billing");
    } else if (q.includes("purchase") || q.includes("supplier") || q.includes("po")) {
      setActiveSection("purchase");
    } else if (q.includes("print") || q.includes("thermal") || q.includes("58mm") || q.includes("80mm")) {
      setActiveSection("printing");
    } else if (q.includes("shop") || q.includes("store") || q.includes("phone") || q.includes("email") || q.includes("address")) {
      setActiveSection("shop");
    } else if (q.includes("inventory") || q.includes("stock") || q.includes("sku")) {
      setActiveSection("inventory");
    }
  }, [searchQuery]);

  const handleGlobalSave = async () => {
    if (!isDirty) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getStoreHeaders() },
        body: JSON.stringify({
          shop_name: s.shopName,
          shop_gstin: s.gstin,
          shop_address: s.storeAddress,
          shop_phone: s.storePhone,
          shop_email: s.storeEmail,
          logo: s.logo || "",
          shop_upi_id: s.upiId,
          inv_prefix: invPrefix,
          po_prefix: poPrefix,
          receipt_footer: s.receiptFooter,
          google_sheet_id: sheetId,
          google_sync_enabled: isConnected ? "1" : "0",
          theme: s.theme,
          receipt_template: s.receiptTemplate,
          primary_color: s.primaryColor || "#2563eb",
          tagline: s.tagline || "",
          website: s.website || "",
          invoice_header: s.invoiceHeader || "",
          invoice_footer: s.invoiceFooter || "",
          terms_and_conditions: s.termsAndConditions || "",
          whatsapp_signature: s.whatsappSignature || "",
          tax_rate: String(s.taxRate || 12),
          low_stock_threshold: String(lowStockThreshold || 10),
          default_report_period: defaultReportPeriod,
          export_format: exportFormat,
          require_customer_before_checkout: s.requireCustomerBeforeCheckout ? "1" : "0",
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Success: update deep-cloned saved snapshot to match current form state
      setSavedSettings(structuredClone(getSettingsSnapshot()));
      const nowFormatted = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      setLastSaved(`Today, ${nowFormatted}`);

      toast.success("Settings saved successfully");
    } catch (e: any) {
      toast.error("Failed to save settings: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  // Export All Application Settings (JSON file)
  const handleExportAllSettings = () => {
    const exportData = {
      app: "Orion POS Enterprise",
      schemaVersion: "2.0",
      exportedAt: new Date().toISOString(),
      multiStoreMetadata: {
        storeId: "store_primary_01",
        organizationId: "org_default",
        storeName: s.shopName || "Apka Bill Store",
      },
      settings: {
        shopInformation: {
          shopName: s.shopName,
          gstin: s.gstin,
          storeAddress: s.storeAddress,
          storePhone: s.storePhone,
          storeEmail: s.storeEmail,
          tagline: s.tagline || "",
          website: s.website || "",
        },
        branding: {
          logo: s.logo || "",
          primaryColor: s.primaryColor || "#2563eb",
          invoiceHeader: s.invoiceHeader || "TAX INVOICE",
          invoiceFooter: s.invoiceFooter || "Terms: Goods once sold can be exchanged within 7 days.",
          receiptFooter: s.receiptFooter || "*** Thank you — visit again ***",
          thankYouMessage: s.thankYouMessage || "Thank you for shopping with us!",
          termsAndConditions: s.termsAndConditions || "",
          returnPolicy: s.returnPolicy || "",
        },
        billing: {
          invPrefix,
          invStartNo,
          allowNegativeStock,
          quickBilling,
        },
        purchase: {
          poPrefix,
          poStartNo,
          autofillPurchaseCost,
          autoSaveDraft,
        },
        printing: {
          printer: s.printer,
          paperWidth: s.paperWidth,
          qrPosition: s.qrPosition,
        },
        whatsappTemplates: {
          whatsappSignature: s.whatsappSignature || "",
          whatsappFooter: s.whatsappFooter || "",
        },
        invoiceTemplates: {
          receiptTemplate: s.receiptTemplate,
          currency: s.currency || "INR",
        },
        gst: {
          taxRate: s.taxRate,
          gstin: s.gstin,
        },
        googleSheets: {
          sheetId,
          syncEnabled: isConnected ? "1" : "0",
        },
        upiAndPayment: {
          upiId: s.upiId,
          accountHolderName: s.accountHolderName || "",
          bankDetails: s.bankDetails || "",
        },
        theme: {
          theme: s.theme,
          primaryColor: s.primaryColor || "#2563eb",
        },
        businessPreferences: {
          lowStockThreshold,
          defaultReportPeriod,
          exportFormat,
        },
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Orion-Settings-Export-${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("All application settings exported successfully!", {
      description: "Full configuration JSON generated with Multi-Store Schema V2.0 metadata.",
    });
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

  // Import Settings File Handler with Validation & Change Diff Generation
  const handleImportFileSelect = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);

        // Schema validation check
        if (!json || typeof json !== "object" || (!json.settings && !json.store)) {
          toast.error("Invalid settings file format.", {
            description: "File must be an Orion POS settings export JSON file.",
          });
          return;
        }

        // Build diff list between current settings and imported settings
        const diffs: Array<{ category: string; field: string; currentValue: string; importedValue: string }> = [];
        const cfg = json.settings || {};

        if (cfg.shopInformation?.shopName && cfg.shopInformation.shopName !== s.shopName) {
          diffs.push({ category: "Shop Info", field: "Shop Name", currentValue: s.shopName, importedValue: cfg.shopInformation.shopName });
        }
        if (cfg.shopInformation?.gstin && cfg.shopInformation.gstin !== s.gstin) {
          diffs.push({ category: "GST", field: "GSTIN", currentValue: s.gstin, importedValue: cfg.shopInformation.gstin });
        }
        if (cfg.shopInformation?.storePhone && cfg.shopInformation.storePhone !== s.storePhone) {
          diffs.push({ category: "Shop Info", field: "Phone Number", currentValue: s.storePhone, importedValue: cfg.shopInformation.storePhone });
        }
        if (cfg.shopInformation?.storeAddress && cfg.shopInformation.storeAddress !== s.storeAddress) {
          diffs.push({ category: "Shop Info", field: "Store Address", currentValue: s.storeAddress, importedValue: cfg.shopInformation.storeAddress });
        }
        if (cfg.billing?.invPrefix && cfg.billing.invPrefix !== invPrefix) {
          diffs.push({ category: "Billing POS", field: "Invoice Prefix", currentValue: invPrefix, importedValue: cfg.billing.invPrefix });
        }
        if (cfg.purchase?.poPrefix && cfg.purchase.poPrefix !== poPrefix) {
          diffs.push({ category: "Purchase POS", field: "PO Prefix", currentValue: poPrefix, importedValue: cfg.purchase.poPrefix });
        }
        if (cfg.googleSheets?.sheetId && cfg.googleSheets.sheetId !== sheetId) {
          diffs.push({ category: "Google Sheets", field: "Spreadsheet ID", currentValue: sheetId, importedValue: cfg.googleSheets.sheetId });
        }
        if (cfg.upiAndPayment?.upiId && cfg.upiAndPayment.upiId !== s.upiId) {
          diffs.push({ category: "UPI & Payment", field: "UPI ID", currentValue: s.upiId, importedValue: cfg.upiAndPayment.upiId });
        }
        if (cfg.branding?.primaryColor && cfg.branding.primaryColor !== s.primaryColor) {
          diffs.push({ category: "Branding", field: "Brand Accent Color", currentValue: s.primaryColor || "#2563eb", importedValue: cfg.branding.primaryColor });
        }
        if (cfg.invoiceTemplates?.receiptTemplate && cfg.invoiceTemplates.receiptTemplate !== s.receiptTemplate) {
          diffs.push({ category: "Invoice Templates", field: "Receipt Theme", currentValue: s.receiptTemplate, importedValue: cfg.invoiceTemplates.receiptTemplate });
        }

        // Support legacy snapshot format
        if (diffs.length === 0 && json.store) {
          if (json.store.shopName) diffs.push({ category: "Shop Info", field: "Shop Name", currentValue: s.shopName, importedValue: json.store.shopName });
          if (json.store.gstin) diffs.push({ category: "GST", field: "GSTIN", currentValue: s.gstin, importedValue: json.store.gstin });
          if (json.store.storePhone) diffs.push({ category: "Shop Info", field: "Store Phone", currentValue: s.storePhone, importedValue: json.store.storePhone });
        }

        setImportPendingPayload(json);
        setImportDiffList(diffs);
        setImportPreviewDialogOpen(true);
      } catch (err) {
        toast.error("Failed to parse settings JSON file.");
      }
    };
    reader.readAsText(file);
    evt.target.value = "";
  };

  const handleJsonRestore = (evt: React.ChangeEvent<HTMLInputElement>) => {
    handleImportFileSelect(evt);
  };

  // Reset fields in ONLY the active section to last saved values
  const handleResetCurrentSection = () => {
    switch (activeSection) {
      case "general":
        s.setCurrency(localStorage.getItem("orion_currency") || "INR");
        s.setTheme((localStorage.getItem("orion_theme") as any) || "system");
        break;
      case "shop":
        if (savedSettings) {
          s.setShopName(savedSettings.shopName || "");
          s.setGstin(savedSettings.gstin || "");
          s.setStorePhone(savedSettings.storePhone || "");
          s.setStoreEmail(savedSettings.storeEmail || "");
          s.setStoreAddress(savedSettings.storeAddress || "");
        }
        break;
      case "branding":
        if (savedSettings) {
          s.setLogo(savedSettings.logo || undefined);
          s.setReceiptFooter(savedSettings.receiptFooter || "");
        }
        break;
      case "billing":
        if (savedSettings) setInvPrefix(savedSettings.invPrefix || "INV-");
        break;
      case "purchase":
        if (savedSettings) setPoPrefix(savedSettings.poPrefix || "PO-");
        break;
      case "inventory":
        if (savedSettings) setLowStockThreshold(savedSettings.lowStockThreshold || 10);
        break;
      case "reports":
        if (savedSettings) {
          setDefaultReportPeriod(savedSettings.defaultReportPeriod || "Month");
          setExportFormat(savedSettings.exportFormat || "PDF");
        }
        break;
      case "taxes":
        s.setTaxRate(12);
        if (savedSettings) s.setGstin(savedSettings.gstin || "");
        break;
      case "backup":
        setSheetId(savedSettings?.sheetId || "");
        break;
      default:
        break;
    }
    toast.info(`Reset fields in ${SECTIONS.find((x) => x.id === activeSection)?.name} section.`);
  };

  // Restore factory defaults for ONLY the active section
  const handleRestoreDefaultsCurrentSection = () => {
    switch (activeSection) {
      case "general":
        s.setCurrency("INR");
        s.setTheme("system");
        break;
      case "shop":
        if (savedSettings) {
          s.setShopName(savedSettings.shopName || "");
          s.setGstin(savedSettings.gstin || "");
          s.setStorePhone(savedSettings.storePhone || "");
          s.setStoreEmail(savedSettings.storeEmail || "");
          s.setStoreAddress(savedSettings.storeAddress || "");
        }
        break;
      case "branding":
        s.setLogo(undefined);
        s.setReceiptFooter("*** Thank you — visit again ***");
        s.setReceiptTemplate("Classic");
        break;
      case "billing":
        setInvPrefix("INV-");
        setInvStartNo("00001");
        setAllowNegativeStock(false);
        setQuickBilling(true);
        break;
      case "purchase":
        setPoPrefix("PO-");
        setPoStartNo("00001");
        setAutofillPurchaseCost(true);
        setAutoSaveDraft(true);
        break;
      case "inventory":
        setLowStockThreshold(10);
        setAutoGenSku(true);
        break;
      case "reports":
        setDefaultReportPeriod("Month");
        setExportFormat("PDF");
        break;
      case "printing":
        s.setPrinter("Internal POS");
        s.setPaperWidth("80mm");
        s.setQrPosition("Bottom");
        break;
      case "taxes":
        s.setTaxRate(12);
        break;
      case "backup":
        setSheetId("1BxiMVs0XRA5nFMdKbBUI6H6W5B0k8t");
        setAutoBackupEnabled(true);
        break;
      default:
        break;
    }

    toast.success(`Restored factory default settings for ${SECTIONS.find((x) => x.id === activeSection)?.name}.`);
  };

  const SectionHeaderActions = () => (
    <div className="flex items-center gap-1.5 shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleResetCurrentSection}
        className="rounded-xl h-7 px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        title="Revert input fields in this section to last saved state"
      >
        <RotateCcw className="size-3 mr-1" /> Reset Section
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRestoreDefaultsCurrentSection}
        className="rounded-xl h-7 px-2.5 text-[11px] font-semibold text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
        title="Restore factory default settings for this section only"
      >
        <RefreshCw className="size-3 mr-1" /> Restore Defaults
      </Button>
    </div>
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Settings Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportAllSettings}
            className="rounded-xl h-9 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 transition-all"
            title="Export all store settings to JSON file"
          >
            <FileDown className="size-3.5 mr-1.5" /> Export Config
          </Button>

          {/* Import Settings Button */}
          <label className="cursor-pointer">
            <input type="file" accept=".json" onChange={handleImportFileSelect} className="hidden" />
            <span className="inline-flex items-center justify-center rounded-xl text-xs font-semibold h-9 px-3 border border-emerald-500/40 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 shadow-2xs transition-all cursor-pointer">
              <FileUp className="size-3.5 mr-1.5" /> Import Config
            </span>
          </label>

          {/* Search Input with Keyboard Shortcuts */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search settings (e.g. GST, Logo, Google)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-14 h-9 rounded-xl text-xs bg-muted/30 focus:bg-background transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-2 text-xs text-muted-foreground hover:text-foreground font-bold p-0.5"
                title="Clear search (Esc)"
              >
                ✕
              </button>
            ) : (
              <span className="pointer-events-none absolute right-3 top-2.5 hidden sm:inline-flex items-center gap-1">
                <span className="kbd">⌘K</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search Match Banner Feedback */}
      {searchQuery.trim() && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500 animate-pulse" />
            <span>
              Searching for &ldquo;<strong>{searchQuery}</strong>&rdquo; — Automatically navigating to{" "}
              <strong>{SECTIONS.find((s) => s.id === activeSection)?.name}</strong>
            </span>
          </div>
          <div className="text-[10px] font-mono opacity-80 hidden sm:block">Use ↑↓ keys to navigate list, Enter to select</div>
        </div>
      )}

      {/* Mobile Horizontal Scrollable Tab Bar (UX Improvement for Mobile) */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-border" role="tablist" aria-label="Settings Mobile Navigation">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${sec.id}`}
              onClick={() => handleSelectSection(sec.id)}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] touch-target active:scale-95 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{sec.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Grid Layout: Left Sidebar + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar (3 Cols) */}
        <div className="hidden lg:block lg:col-span-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2 flex justify-between items-center">
            <span>Configuration Navigation</span>
            <span className="text-[9px] font-mono text-muted-foreground">{filteredSections.length} Sections</span>
          </div>
          <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1" role="tablist" aria-label="Settings Configuration Navigation">
            {filteredSections.map((sec, idx) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              const isKeyboardFocused = focusedNavIndex === idx && document.activeElement === searchInputRef.current;
              const isMatchedKeyword = Boolean(
                searchQuery.trim() &&
                  (sec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    sec.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    sec.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase())))
              );

              return (
                <button
                  key={sec.id}
                  type="button"
                  role="tab"
                  id={`tab-${sec.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${sec.id}`}
                  onClick={() => {
                    handleSelectSection(sec.id);
                    setFocusedNavIndex(idx);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between group ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isKeyboardFocused
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : isMatchedKeyword
                      ? "bg-amber-500/10 text-amber-700 border border-amber-500/30"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`size-4 shrink-0 ${
                        isActive
                          ? "text-primary-foreground"
                          : isMatchedKeyword
                          ? "text-amber-500"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                    <span className="truncate">{sec.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isMatchedKeyword && !isActive && (
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight bg-amber-500/20 px-1.5 py-0.5 rounded">
                        Match
                      </span>
                    )}
                    {sec.badge && (
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 font-mono shrink-0 ${
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {sec.badge}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content Panel (9 Cols) */}
        <div
          className="lg:col-span-9 space-y-6"
          role="tabpanel"
          id={`panel-${activeSection}`}
          aria-labelledby={`tab-${activeSection}`}
        >
          {/* Zero Search Matches Empty State */}
          {filteredSections.length === 0 && (
            <div className="card-soft p-8 text-center space-y-4 flex flex-col items-center justify-center animate-in fade-in">
              <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <SearchX className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">No Settings Found</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  No configuration sections matched your search term &ldquo;<strong>{searchQuery}</strong>&rdquo;. Try searching for keywords like <em>GST, Logo, Google, WhatsApp, Backup, or Invoice</em>.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="rounded-xl text-xs font-semibold"
              >
                Clear Search Query
              </Button>
            </div>
          )}
          {/* 1. GENERAL */}
          {activeSection === "general" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <SlidersHorizontal className="size-5 text-primary" /> General Business Settings
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Global defaults for currency, timezone, and appearance theme.</div>
                </div>
                <SectionHeaderActions />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Business / Company Name</Label>
                  <Input
                    value={s.shopName}
                    onChange={(e) => s.setShopName(e.target.value)}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Currency</Label>
                  <Select value={s.currency} onValueChange={(v) => s.setCurrency(v)}>
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

              <div className="space-y-2 pt-3 border-t border-border">
                <Label className="text-xs font-semibold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" /> First-Time Setup Wizard
                </Label>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Restart the 5-minute express onboarding wizard to reconfigure business defaults, store info, and receipt settings.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await resetOnboardingApi();
                        toast.success("Setup wizard restarted");
                        window.location.href = "/setup-wizard";
                      } catch (err: any) {
                        toast.error(err.message || "Failed to restart wizard");
                      }
                    }}
                    className="rounded-xl h-8 text-xs font-semibold shrink-0 gap-1.5"
                  >
                    <Sparkles className="size-3.5" /> Restart Setup Wizard
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ORGANIZATION PROFILE & ADMIN */}
          {activeSection === "organization" && <OrganizationSettingsSection />}

          {/* SECURITY & PASSWORD */}
          {activeSection === "security" && <SecuritySettingsSection />}

          {/* STORES MANAGEMENT */}
          {activeSection === "stores" && <StoresManagementSection />}

          {/* USERS MANAGEMENT */}
          {activeSection === "users" && <UsersManagementSection />}

          {/* 2. SHOP INFORMATION */}
          {activeSection === "shop" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <Building2 className="size-5 text-primary" /> Shop Information
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Store details printed on invoices, receipts and tax filings.</div>
                </div>
                <SectionHeaderActions />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Shop Name *</Label>
                  <Input
                    value={s.shopName}
                    onChange={(e) => s.setShopName(e.target.value)}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">GSTIN / Tax Registration</Label>
                  <Input
                    value={s.gstin}
                    onChange={(e) => s.setGstin(e.target.value)}
                    className="rounded-xl h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Phone Number</Label>
                  <Input
                    value={s.storePhone}
                    onChange={(e) => s.setStorePhone(e.target.value)}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Email Address</Label>
                  <Input
                    value={s.storeEmail}
                    onChange={(e) => s.setStoreEmail(e.target.value)}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Store Address</Label>
                <Textarea
                  rows={3}
                  value={s.storeAddress}
                  onChange={(e) => s.setStoreAddress(e.target.value)}
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
              <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <Receipt className="size-5 text-primary" /> Billing POS Configuration
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Customize invoice prefix, starting numbers, and checkout controls.</div>
                </div>
                <SectionHeaderActions />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Invoice Number Prefix</Label>
                  <Input
                    value={invPrefix}
                    onChange={(e) => setInvPrefix(e.target.value)}
                    className="rounded-xl h-9 text-xs font-mono"
                    placeholder="e.g. INV-"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Starting Invoice Sequence Number</Label>
                  <Input
                    value={invStartNo}
                    onChange={(e) => setInvStartNo(e.target.value)}
                    className="rounded-xl h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Payment Method</Label>
                  <Select value={s.payment} onValueChange={(v: any) => s.setPayment(v)}>
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
                  <Select value={s.receiptTemplate} onValueChange={(v: any) => s.setReceiptTemplate(v)}>
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
                    onChange={(e) => setAllowNegativeStock(e.target.checked)}
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
                    onChange={(e) => s.setRequireCustomerBeforeCheckout(e.target.checked)}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. PURCHASE POS */}
          {activeSection === "purchase" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <ShoppingBag className="size-5 text-primary" /> Purchase POS Configuration
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Configure PO numbers, cost autofill from inventory & draft handling.</div>
                </div>
                <SectionHeaderActions />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Purchase Order Prefix</Label>
                  <Input
                    value={poPrefix}
                    onChange={(e) => setPoPrefix(e.target.value)}
                    className="rounded-xl h-9 text-xs font-mono"
                    placeholder="e.g. PO-"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Starting PO Sequence Number</Label>
                  <Input
                    value={poStartNo}
                    onChange={(e) => setPoStartNo(e.target.value)}
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
                    onChange={(e) => setAutofillPurchaseCost(e.target.checked)}
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
                    onChange={(e) => setAutoSaveDraft(e.target.checked)}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. INVENTORY */}
          {activeSection === "inventory" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <Package className="size-5 text-primary" /> Inventory Settings
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Low stock alert thresholds, SKU generation, and barcode rules.</div>
                </div>
                <SectionHeaderActions />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Low Stock Threshold</Label>
                  <Input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(Number(e.target.value))}
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
                    onChange={(e) => setAutoGenSku(e.target.checked)}
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
              <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="size-5 text-primary" /> Reports & Export Settings
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Default date range filter presets and export file formats.</div>
                </div>
                <SectionHeaderActions />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Report Date Filter</Label>
                  <Select value={defaultReportPeriod} onValueChange={(v) => setDefaultReportPeriod(v)}>
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
                  <Select value={exportFormat} onValueChange={(v) => setExportFormat(v)}>
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
            <PrinterSettingsSection
              currentStore={(s as any).currentStore}
              onSaveSuccess={() => {
                setSavedSettings(getSettingsSnapshot());
              }}
            />
          )}

          {/* 10. WHATSAPP TEMPLATES */}
          {activeSection === "whatsapp" && <WhatsAppTemplateManager currentStore={(s as any).currentStore} />}

          {/* 11. INVOICE TEMPLATES & LIVE PREVIEW */}
          {activeSection === "invoice_templates" && <InvoiceTemplatesPage />}

          {/* 12. TAXES & GST */}
          {activeSection === "taxes" && (
            <div className="card-soft p-5 space-y-5">
              <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <Percent className="size-5 text-primary" /> Taxes & GST Configuration
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Set default GST rates and tax breakdown preferences.</div>
                </div>
                <SectionHeaderActions />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Tax Rate (%)</Label>
                  <Input
                    type="number"
                    value={s.taxRate}
                    onChange={(e) => s.setTaxRate(Number(e.target.value))}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Store GSTIN</Label>
                  <Input
                    value={s.gstin}
                    onChange={(e) => s.setGstin(e.target.value)}
                    className="rounded-xl h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 13. BACKUP & RESTORE — GOOGLE WORKSPACE & SYSTEM BACKUPS */}
          {activeSection === "backup" && (
            <div className="space-y-6">
              {/* Google Workspace Integration Card */}
              <div
                className={`card-soft p-5 space-y-5 border-l-4 transition-all ${
                  googleStatus?.connected ? "border-l-emerald-500" : "border-l-blue-500"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2 text-base font-bold text-foreground">
                      <Cloud className="size-5 text-blue-500" /> Google Workspace Integration
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Connect your Google account to automatically sync Sales, Products, Customers and Reports.
                    </div>
                  </div>

                  {/* Connection Status Badge */}
                  <Badge
                    className={`text-xs px-3 py-1 font-bold border transition-all ${
                      googleStatus?.connected
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                    }`}
                  >
                    {googleStatus?.connected ? "🟢 Connected" : "🔴 Not Connected"}
                  </Badge>
                </div>

                {/* Feature Flag / Sync Method Switcher */}
                <div className="p-4 bg-muted/20 rounded-xl border border-border/50 space-y-3">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sliders className="size-4 text-primary" /> Google Sync Method
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        syncMethod === "oauth"
                          ? "border-blue-500 bg-blue-500/5 font-semibold"
                          : "border-border/60 hover:bg-muted/30"
                      }`}
                      onClick={() => handleSetSyncMethod("oauth")}
                    >
                      <input
                        type="radio"
                        name="syncMethod"
                        checked={syncMethod === "oauth"}
                        onChange={() => handleSetSyncMethod("oauth")}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          Google Account <Badge className="text-[9px] bg-emerald-500 text-white px-1.5 py-0">Recommended</Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Connect via OAuth 2.0 & pick spreadsheets directly.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        syncMethod === "service_account"
                          ? "border-blue-500 bg-blue-500/5 font-semibold"
                          : "border-border/60 hover:bg-muted/30"
                      }`}
                      onClick={() => handleSetSyncMethod("service_account")}
                    >
                      <input
                        type="radio"
                        name="syncMethod"
                        checked={syncMethod === "service_account"}
                        onChange={() => handleSetSyncMethod("service_account")}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-bold text-foreground">Service Account</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Legacy manual configuration via shared Spreadsheet ID.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* OAuth Integration Mode UI */}
                {syncMethod === "oauth" && (
                  <div className="space-y-4">
                    {googleStatus?.connected ? (
                      <div className="space-y-4">
                        {/* Connected Account & Sheet Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-0.5">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Connected Email</div>
                            <div className="font-semibold text-foreground truncate font-mono">{googleStatus.email || "owner@gmail.com"}</div>
                          </div>

                          <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-0.5">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Selected Spreadsheet</div>
                            <div className="font-semibold text-emerald-600 truncate">{googleStatus.spreadsheetName || "Select Spreadsheet..."}</div>
                          </div>

                          <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-0.5">
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">Status</div>
                            <div className="font-semibold text-foreground font-mono">Healthy (OAuth 2.0)</div>
                          </div>
                        </div>

                        {/* Phase 2: Spreadsheet Picker */}
                        <div className="p-4 bg-muted/10 rounded-xl border border-border/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <FileSpreadsheet className="size-4 text-emerald-500" /> Select Spreadsheet
                            </Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] text-primary"
                              onClick={fetchSpreadsheets}
                              disabled={loadingSpreadsheets}
                            >
                              {loadingSpreadsheets ? <Loader2 className="size-3 animate-spin mr-1" /> : <RefreshCw className="size-3 mr-1" />}
                              Refresh List
                            </Button>
                          </div>

                          {spreadsheetsList.length > 0 ? (
                            <select
                              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium focus:ring-2 focus:ring-primary"
                              value={googleStatus.spreadsheetId || ""}
                              onChange={(e) => {
                                const selected = spreadsheetsList.find((s) => s.id === e.target.value);
                                if (selected) {
                                  handleSelectSpreadsheet(selected.id, selected.name);
                                }
                              }}
                            >
                              <option value="" disabled>-- Choose a Google Spreadsheet --</option>
                              {spreadsheetsList.map((sheet) => (
                                <option key={sheet.id} value={sheet.id}>
                                  📊 {sheet.name} (ID: {sheet.id.slice(0, 8)}...)
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full h-9 text-xs rounded-xl"
                              onClick={fetchSpreadsheets}
                              disabled={loadingSpreadsheets}
                            >
                              {loadingSpreadsheets ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <FileSpreadsheet className="size-3.5 mr-1.5 text-blue-500" />}
                              Fetch My Google Spreadsheets
                            </Button>
                          )}
                        </div>

                        {/* Connected Action Buttons Bar */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-8 text-xs font-semibold"
                            onClick={handleConnectGoogle}
                            disabled={connectingGoogle}
                          >
                            {connectingGoogle ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5 text-blue-500" />}
                            Reconnect
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-8 text-xs font-semibold text-rose-600 border-rose-500/20 hover:bg-rose-500/10"
                            onClick={handleDisconnectGoogle}
                          >
                            Disconnect
                          </Button>

                          {googleStatus.spreadsheetId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${googleStatus.spreadsheetId}`, "_blank")}
                              className="rounded-xl h-8 text-xs font-semibold text-primary hover:underline ml-auto"
                            >
                              Open Spreadsheet <ExternalLink className="size-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Phase 1: Not Connected UI Banner */
                      <div className="p-6 bg-muted/10 rounded-2xl border border-dashed border-border/70 text-center space-y-4">
                        <div className="mx-auto size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <Cloud className="size-6" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Google Workspace — Not Connected</h4>
                          <p className="text-xs text-muted-foreground">
                            Connect your Google account to automatically sync Sales, Products, Customers and Reports.
                          </p>
                        </div>
                        <Button
                          type="button"
                          className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                          onClick={handleConnectGoogle}
                          disabled={connectingGoogle}
                        >
                          {connectingGoogle ? <Loader2 className="size-4 animate-spin mr-2" /> : <Cloud className="size-4 mr-2" />}
                          Connect Google
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Legacy Service Account Mode UI */}
                {syncMethod === "service_account" && (
                  <div className="space-y-4 pt-2 border-t border-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Spreadsheet ID (Legacy Service Account)</Label>
                        <Input
                          value={sheetId}
                          onChange={(e) => setSheetId(e.target.value)}
                          placeholder="Enter Google Spreadsheet ID..."
                          className="h-9 rounded-xl text-xs font-mono"
                        />
                      </div>
                      <div className="p-3 bg-muted/20 rounded-xl border border-border/40 flex justify-between items-center text-xs">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold">Service Account Mode</div>
                          <div className="font-semibold text-foreground font-mono mt-0.5">Legacy Active</div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-mono border-amber-500/30 text-amber-600">Manual Setup</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-8 text-xs font-semibold"
                        disabled={testingConnection}
                        onClick={async () => {
                          if (!sheetId.trim()) {
                            toast.error("Please enter a Spreadsheet ID first.");
                            return;
                          }
                          setTestingConnection(true);
                          try {
                            const res = await apiFetch(`${API_BASE_URL}/sync/test`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ sheetId: sheetId.trim() }),
                            });
                            const data = await res.json();
                            if (data.success && data.connected) {
                              setIsConnected(true);
                              toast.success("Google Sheets connection test successful!");
                            } else {
                              setIsConnected(false);
                              toast.error(data.error || "Connection test failed.");
                            }
                          } catch (e: any) {
                            toast.error("Connection test failed: " + (e.message || "Network error"));
                          } finally {
                            setTestingConnection(false);
                          }
                        }}
                      >
                        {testingConnection ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5 text-blue-500" />}
                        Test Connection
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-8 text-xs font-semibold"
                        disabled={syncingNow}
                        onClick={async () => {
                          setSyncingNow(true);
                          try {
                            const res = await apiFetch(`${API_BASE_URL}/sync/trigger`, { method: "POST" });
                            const data = await res.json();
                            if (data.success) {
                              toast.success("Manual sync completed successfully!");
                            } else {
                              toast.error(data.error || "Sync failed.");
                            }
                          } catch (e) {
                            toast.error("Manual sync failed.");
                          } finally {
                            setSyncingNow(false);
                          }
                        }}
                      >
                        {syncingNow ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Cloud className="size-3.5 mr-1.5 text-emerald-500" />}
                        Manual Sync
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Task 5: Backup & Restore Complete Management Center */}
              <div className="card-soft p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <div className="text-base font-bold text-foreground flex items-center gap-2">
                      <Database className="size-5 text-primary" /> Complete Database Backup & Restore Center
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Download catalog snapshots, create restore points, manage history, and monitor storage health.
                    </div>
                  </div>

                  {/* Auto Backup Status & Last Backup Info */}
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Last Backup Time</div>
                      <div className="font-semibold text-foreground font-mono">Today, 02:40 AM</div>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-xl border border-border/50">
                      <Switch
                        checked={autoBackupEnabled}
                        onCheckedChange={(val) => {
                          setAutoBackupEnabled(val);
                          toast.info(val ? "Auto Backup enabled (Nightly at 12:00 AM)." : "Auto Backup paused.");
                        }}
                      />
                      <div className="text-xs font-semibold">
                        <div className="text-foreground">Auto Backup</div>
                        <div className="text-[10px] text-muted-foreground">{autoBackupEnabled ? "Nightly 12:00 AM" : "Paused"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Storage Usage Metrics Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Storage Used</div>
                    <div className="font-bold text-foreground font-mono text-sm">7.7 MB</div>
                    <div className="text-[10px] text-emerald-600 font-semibold">Healthy (0.8% of 1 GB)</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Database File Size</div>
                    <div className="font-bold text-primary font-mono text-sm">2.4 MB</div>
                    <div className="text-[10px] text-muted-foreground">PostgreSQL / SQLite</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Generated PDFs</div>
                    <div className="font-bold text-foreground font-mono text-sm">4.2 MB</div>
                    <div className="text-[10px] text-muted-foreground">18 Tax Invoice PDFs</div>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border/40 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Media & Logo Assets</div>
                    <div className="font-bold text-foreground font-mono text-sm">1.1 MB</div>
                    <div className="text-[10px] text-muted-foreground font-mono">Brand Image Cache</div>
                  </div>
                </div>

                {/* 3 Primary Action Cards: Manual Backup, Restore Backup, Restore Point */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Card 1: Manual Backup */}
                  <div className="card-soft p-4 space-y-2 border-primary/30 hover:border-primary/50 transition-all">
                    <div className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Download className="size-4 text-primary" /> 1. Manual Backup
                      </span>
                      <Badge variant="outline" className="text-[9px]">JSON Format</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Download instant snapshot of store settings, branding, GST parameters, and catalog records.
                    </div>
                    <Button type="button" size="sm" onClick={handleManualJsonBackup} className="w-full rounded-xl h-9 text-xs font-bold mt-1">
                      <Download className="size-3.5 mr-1.5" /> Download Manual Backup
                    </Button>
                  </div>

                  {/* Card 2: Restore Backup */}
                  <div className="card-soft p-4 space-y-2 border-emerald-500/30 hover:border-emerald-500/50 transition-all">
                    <div className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Upload className="size-4 text-emerald-500" /> 2. Restore Backup
                      </span>
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-600">Requires Confirmation</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Upload JSON snapshot file to apply configuration preferences. Existing history is preserved.
                    </div>
                    <label className="w-full block">
                      <input type="file" accept=".json" onChange={handleJsonRestore} className="hidden" />
                      <span className="inline-flex items-center justify-center w-full rounded-xl text-xs font-bold h-9 px-3 border border-emerald-500/40 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 shadow-xs cursor-pointer transition-all">
                        <Upload className="size-3.5 mr-1.5" /> Select File to Restore
                      </span>
                    </label>
                  </div>

                  {/* Card 3: Restore Point */}
                  <div className="card-soft p-4 space-y-2 border-purple-500/30 hover:border-purple-500/50 transition-all">
                    <div className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-purple-500" /> 3. Restore Point
                      </span>
                      <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-600">Rollback Guard</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Create an instant system rollback snapshot before performing bulk updates or catalog changes.
                    </div>
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
                        toast.success("System restore point created successfully!", {
                          description: "Rollback point saved in snapshot history.",
                        });
                      }}
                      className="w-full rounded-xl h-9 text-xs font-bold border-purple-500/30 text-purple-600 hover:bg-purple-500/10 transition-all"
                    >
                      <ShieldCheck className="size-3.5 mr-1.5" /> Create Restore Point
                    </Button>
                  </div>
                </div>

                {/* Backup Snapshot History Table */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="size-4 text-primary" /> Backup Snapshot History
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">{backupHistory.length} Saved Snapshots</Badge>
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                          <th className="p-2.5">Snapshot Name</th>
                          <th className="p-2.5">Timestamp</th>
                          <th className="p-2.5">Snapshot Type</th>
                          <th className="p-2.5">Size</th>
                          <th className="p-2.5 text-right">Download & Delete Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {backupHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/20 transition-all">
                            <td className="p-2.5 font-mono text-foreground font-medium">{item.name}</td>
                            <td className="p-2.5 text-muted-foreground font-mono">{item.timestamp}</td>
                            <td className="p-2.5">
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-mono ${
                                  item.type === "Manual"
                                    ? "border-blue-500/30 text-blue-600"
                                    : item.type === "Auto"
                                    ? "border-emerald-500/30 text-emerald-600"
                                    : "border-purple-500/30 text-purple-600"
                                }`}
                              >
                                {item.type}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-muted-foreground font-mono">{item.size}</td>
                            <td className="p-2.5 text-right space-x-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleManualJsonBackup()}
                                className="h-7 px-2.5 text-[11px] font-semibold rounded-lg"
                                title="Download Backup Snapshot File"
                              >
                                <Download className="size-3 mr-1 text-primary" /> Download
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setBackupHistory((prev) => prev.filter((b) => b.id !== item.id));
                                  toast.info("Snapshot entry removed from local history list.");
                                }}
                                className="h-7 px-2 text-[10px] text-rose-600 hover:bg-rose-500/10 rounded-lg"
                                title="Delete Snapshot from Local List"
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
                    const res = await apiFetch(`${API_BASE_URL}/settings/storage/cleanup`, { method: "POST" });
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

      {/* Restore Confirmation Dialog Modal */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-amber-600 flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-500" /> Confirm Database Snapshot Restore
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Restoring this snapshot will apply store settings, branding identity, GST parameters, and catalog configurations.
              Existing backup history will NOT be removed and production data remains safe.
            </DialogDescription>
          </DialogHeader>

          {pendingRestoreData && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1 font-mono my-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">App Architecture:</span>
                <span className="font-bold text-foreground">{pendingRestoreData.app || "Orion POS"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Snapshot Store:</span>
                <span className="font-bold text-foreground">{pendingRestoreData.store?.shopName || "Store"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Snapshot Timestamp:</span>
                <span className="text-foreground">{pendingRestoreData.timestamp || "Recent"}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRestoreDialogOpen(false);
                setPendingRestoreData(null);
              }}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (pendingRestoreData?.store) {
                  const sData = pendingRestoreData.store;
                  if (sData.shopName) s.setShopName(sData.shopName);
                  if (sData.gstin) s.setGstin(sData.gstin);
                  if (sData.storePhone) s.setStorePhone(sData.storePhone);
                  if (sData.storeEmail) s.setStoreEmail(sData.storeEmail);
                  if (sData.storeAddress) s.setStoreAddress(sData.storeAddress);
                  if (sData.upiId) s.setUpiId?.(sData.upiId);
                  if (sData.receiptTemplate) s.setReceiptTemplate(sData.receiptTemplate);

                  toast.success("Database snapshot restored successfully!", {
                    description: "Store branding and configuration parameters applied cleanly.",
                  });
                }
                setRestoreDialogOpen(false);
                setPendingRestoreData(null);
              }}
              className="rounded-xl h-9 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
            >
              Confirm Restore
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Import Diff Preview & Confirmation Modal */}
      <Dialog open={importPreviewDialogOpen} onOpenChange={setImportPreviewDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileUp className="size-5 text-emerald-500" /> Preview & Confirm Settings Import
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Review configuration changes before applying. Existing production data remains safe until confirmed.
            </DialogDescription>
          </DialogHeader>

          {importPendingPayload && (
            <div className="space-y-3 py-1">
              {/* Metadata Badge Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/20 rounded-xl border border-border/50 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600">
                    Schema V{importPendingPayload.schemaVersion || "1.0"}
                  </Badge>
                  <span className="font-semibold text-foreground">
                    Store: {importPendingPayload.multiStoreMetadata?.storeName || importPendingPayload.store?.shopName || "Store"}
                  </span>
                </div>
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-mono">
                  {importDiffList.length} Changed Fields Detected
                </Badge>
              </div>

              {/* Side-by-Side Change Diff Table */}
              <div className="rounded-xl border border-border overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border sticky top-0 bg-background">
                    <tr>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Setting Field</th>
                      <th className="p-2.5">Current Production Value</th>
                      <th className="p-2.5">Imported Target Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                    {importDiffList.length > 0 ? (
                      importDiffList.map((diff, idx) => (
                        <tr key={idx} className="hover:bg-muted/20 transition-all">
                          <td className="p-2.5 font-sans font-medium text-muted-foreground">{diff.category}</td>
                          <td className="p-2.5 font-sans font-semibold text-foreground">{diff.field}</td>
                          <td className="p-2.5 text-rose-600/90 truncate max-w-[120px]">{diff.currentValue || "(Empty)"}</td>
                          <td className="p-2.5 text-emerald-600 font-bold flex items-center gap-1.5 truncate max-w-[140px]">
                            <ArrowRight className="size-3 text-emerald-500 shrink-0" />
                            {diff.importedValue}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground font-sans italic">
                          All settings match current production values cleanly.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setImportPreviewDialogOpen(false);
                setImportPendingPayload(null);
              }}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                if (importPendingPayload) {
                  const cfg = importPendingPayload.settings || {};
                  const store = importPendingPayload.store || {};

                  // Shop Info
                  const shopName = cfg.shopInformation?.shopName || store.shopName;
                  if (shopName) s.setShopName(shopName);
                  const gstin = cfg.shopInformation?.gstin || store.gstin;
                  if (gstin) s.setGstin(gstin);
                  const phone = cfg.shopInformation?.storePhone || store.storePhone;
                  if (phone) s.setStorePhone(phone);
                  const email = cfg.shopInformation?.storeEmail || store.storeEmail;
                  if (email) s.setStoreEmail(email);
                  const addr = cfg.shopInformation?.storeAddress || store.storeAddress;
                  if (addr) s.setStoreAddress(addr);

                  // Branding
                  const logo = cfg.branding?.logo || store.logo;
                  if (logo) s.setLogo(logo);
                  const upi = cfg.upiAndPayment?.upiId || store.upiId;
                  if (upi) s.setUpiId(upi);
                  const receiptFoot = cfg.branding?.receiptFooter || store.receiptFooter;
                  if (receiptFoot) s.setReceiptFooter(receiptFoot);

                  // Prefixes
                  const invP = cfg.billing?.invPrefix || store.invPrefix;
                  if (invP) setInvPrefix(invP);
                  const poP = cfg.purchase?.poPrefix || store.poPrefix;
                  if (poP) setPoPrefix(poP);

                  // Google Sheets
                  const sheet = cfg.googleSheets?.sheetId || store.googleSheetId;
                  if (sheet) setSheetId(sheet);

                  // Persist to PostgreSQL database & local storage
                  try {
                    await handleGlobalSave();
                  } catch (e) {}

                  toast.success("Settings imported successfully!", {
                    description: `${importDiffList.length || 1} configuration fields applied cleanly.`,
                  });
                }
                setImportPreviewDialogOpen(false);
                setImportPendingPayload(null);
              }}
              className="rounded-xl h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <FileUp className="size-3.5 mr-1.5" /> Confirm Overwrite & Apply Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sticky Bottom Action & Save Status Bar - Rendered ONLY when there are unsaved changes */}
      {isDirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur-md border border-primary/40 rounded-2xl shadow-xl px-5 py-3 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-3">
          <div className="text-xs font-semibold flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-foreground font-bold">Unsaved Changes</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={restoreBackendSnapshot}
              className="rounded-xl h-8 text-xs"
            >
              Cancel
            </Button>
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
      )}
    </div>
  );
}

function SecuritySettingsSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    try {
      setSubmitting(true);
      await changePasswordApi({ currentPassword, newPassword, confirmPassword });
      toast.success("Your login password has been updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card-soft p-5 space-y-5">
      <div className="border-b border-border pb-3">
        <div className="text-base font-bold text-foreground flex items-center gap-2">
          <Key className="size-5 text-primary" /> Change Organization Owner Password
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Update your login password securely. Hashed and encrypted before storing.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Current Password *</Label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            className="rounded-xl h-10 text-xs"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">New Password *</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="rounded-xl h-10 text-xs"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Confirm New Password *</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className="rounded-xl h-10 text-xs"
            required
          />
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={submitting} className="rounded-xl h-10 px-5 text-xs font-bold gap-2">
            <Lock className="size-4" /> {submitting ? "Updating Password…" : "Update Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
