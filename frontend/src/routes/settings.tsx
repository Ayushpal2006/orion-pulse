import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RoleGate } from "@/components/role-gate";
import { useApp, type Role, type PaperWidth } from "@/lib/store";
import { toast } from "sonner";
import { Printer, Upload, Download, RotateCcw, Loader2, Cloud, RefreshCw, CheckCircle2, AlertCircle, HardDrive } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReceiptPreview } from "@/components/receipt-preview";
import { testPrinter, API_BASE_URL } from "@/lib/api";
import { formatToKolkataDateTime } from "@/lib/datetime";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Orion POS" },
      { name: "description", content: "Configure your shop, GSTIN, printer and user roles." },
      { property: "og:title", content: "Settings · Orion POS" },
      { property: "og:description", content: "Business, printer and role setup." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <RoleGate allow={["Admin", "Manager"]}>
      <Settings />
    </RoleGate>
  );
}

function Settings() {
  const s = useApp();

  // Expanded local settings state for improved printing options
  const [characterDensity, setCharacterDensity] = useState<"normal" | "compact">("normal");
  const [darkness, setDarkness] = useState<string>("medium");
  const [testingPrint, setTestingPrint] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Google Sheets state
  const [sheetId, setSheetId] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);

  // PDF Storage state
  const [storageStats, setStorageStats] = useState<any>(null);
  const [cleaningStorage, setCleaningStorage] = useState(false);

  const loadStorageStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/storage`);
      const json = await res.json();
      if (json.success) {
        setStorageStats(json.data);
      }
    } catch (e) {
      console.error("Failed to load storage stats:", e);
    }
  };

  // Load initial settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/settings`);
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          if (d.shop_name) s.setShopName(d.shop_name);
          if (d.shop_gstin) s.setGstin(d.shop_gstin);
          if (d.shop_phone) s.setStorePhone(d.shop_phone);
          if (d.shop_address) s.setStoreAddress(d.shop_address);
          if (d.shop_upi_id) s.setUpiId(d.shop_upi_id);
          if (d.printer_type) s.setPrinter(d.printer_type as any);
          if (d.paper_width) s.setPaperWidth(d.paper_width as any);
          if (d.character_density) setCharacterDensity(d.character_density as any);
          if (d.printer_darkness) setDarkness(d.printer_darkness);
          if (d.whatsapp_footer) s.setWhatsappFooter(d.whatsapp_footer);
          if (d.google_sheet_id) setSheetId(d.google_sheet_id);
          if (d.google_sync_enabled) setSyncEnabled(d.google_sync_enabled === "1");
          if (d.logo) s.setLogo(d.logo);
        }
      } catch (err) {
        console.error("Failed to load settings from SQLite backend:", err);
      } finally {
        setLoaded(true);
      }
    };
    loadSettings();
    loadStorageStats();
  }, []);

  // Poll sync status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sync/status`);
        const json = await res.json();
        if (json.success) {
          setSyncStatus(json.data);
        }
      } catch (e) {}
    };
    fetchStatus();
    const iv = setInterval(fetchStatus, 8000);
    return () => clearInterval(iv);
  }, []);

  // Sync settings with backend SQLite database whenever values change
  useEffect(() => {
    if (!loaded) return;
    const syncSettings = async () => {
      try {
        await fetch(`${API_BASE_URL}/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop_name: s.shopName,
            shop_gstin: s.gstin,
            shop_phone: s.storePhone,
            shop_address: s.storeAddress,
            shop_upi_id: s.upiId,
            printer_type: s.printer,
            paper_width: s.paperWidth,
            character_density: characterDensity,
            printer_darkness: darkness,
            whatsapp_footer: s.whatsappFooter,
            google_sheet_id: sheetId,
            google_sync_enabled: syncEnabled ? "1" : "0",
            logo: s.logo || "",
          }),
        });
      } catch (err) {
        console.error("Failed to sync settings with SQLite backend:", err);
      }
    };
    syncSettings();
  }, [
    s.shopName,
    s.gstin,
    s.storePhone,
    s.storeAddress,
    s.upiId,
    s.printer,
    s.paperWidth,
    characterDensity,
    darkness,
    s.whatsappFooter,
    sheetId,
    syncEnabled,
    s.logo,
    loaded,
  ]);

  const handleTestPrint = async () => {
    setTestingPrint(true);
    try {
      await testPrinter();
      toast.success("Test print page sent successfully", {
        description: `Routed to ${s.printer} (${s.paperWidth})`,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger test print");
    } finally {
      setTestingPrint(false);
    }
  };

  const uploadLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => s.setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Store, hardware, receipts and access control.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Business */}
        <div className="card-soft space-y-4 p-5">
          <div>
            <div className="text-sm font-semibold">Business</div>
            <div className="text-xs text-muted-foreground">Shown on invoices and receipts</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid size-14 place-items-center overflow-hidden rounded-xl bg-muted text-2xl">
              {s.logo ? <img src={s.logo} alt="" className="size-full object-cover" /> : "🏬"}
            </div>
            <div className="flex-1">
              <Label className="text-xs font-medium text-muted-foreground">Business logo</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="h-9 rounded-lg"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                />
                {s.logo && (
                  <Button variant="outline" size="sm" onClick={() => s.setLogo(undefined)}>Clear</Button>
                )}
              </div>
            </div>
          </div>
          <Row label="Shop name">
            <Input value={s.shopName} onChange={(e) => s.setShopName(e.target.value)} className="h-11 rounded-xl" />
          </Row>
          <Row label="GSTIN">
            <Input value={s.gstin} onChange={(e) => s.setGstin(e.target.value)} className="h-11 rounded-xl tabular" />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Currency">
              <Select value={s.currency} onValueChange={s.setCurrency}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">₹ INR</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                  <SelectItem value="AED">د.إ AED</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Default tax %">
              <Input inputMode="numeric" value={s.taxRate} onChange={(e) => s.setTaxRate(Number(e.target.value) || 0)} className="h-11 rounded-xl tabular" />
            </Row>
          </div>
          <Row label="Store address">
            <Textarea rows={2} value={s.storeAddress} onChange={(e) => s.setStoreAddress(e.target.value)} />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Store phone">
              <Input value={s.storePhone} onChange={(e) => s.setStorePhone(e.target.value)} className="h-11 rounded-xl" />
            </Row>
            <Row label="Store email">
              <Input value={s.storeEmail} onChange={(e) => s.setStoreEmail(e.target.value)} className="h-11 rounded-xl" />
            </Row>
          </div>
        </div>

        {/* Printer + Theme */}
        <div className="space-y-4">
          <div className="card-soft space-y-4 p-5">
            <div>
              <div className="text-sm font-semibold">Printer</div>
              <div className="text-xs text-muted-foreground">Thermal slip destination</div>
            </div>
            
            <Select value={s.printer} onValueChange={(v) => s.setPrinter(v as typeof s.printer)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Internal POS">Internal POS</SelectItem>
                <SelectItem value="Bluetooth">Bluetooth</SelectItem>
                <SelectItem value="USB">USB</SelectItem>
              </SelectContent>
            </Select>

            <Row label="Paper width">
              <div className="grid grid-cols-3 gap-2">
                {(["58mm", "80mm", "A4"] as PaperWidth[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => s.setPaperWidth(w)}
                    className={`rounded-xl border p-3 text-sm font-medium transition-colors ${s.paperWidth === w ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted/60"}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </Row>

            {/* Expanded Printing configurations */}
            <div className="grid grid-cols-2 gap-3">
              <Row label="Character density">
                <Select value={characterDensity} onValueChange={(v) => setCharacterDensity(v as any)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Darkness">
                <Select value={darkness} onValueChange={setDarkness}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light (80%)</SelectItem>
                    <SelectItem value="medium">Medium (100%)</SelectItem>
                    <SelectItem value="dark">Dark (120%)</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </div>

            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={handleTestPrint}
              disabled={testingPrint}
            >
              {testingPrint ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Printing...
                </>
              ) : (
                <>
                  <Printer className="mr-2 size-4" /> Test print
                </>
              )}
            </Button>
          </div>

          <div className="card-soft space-y-3 p-5">
            <div>
              <div className="text-sm font-semibold">Theme</div>
              <div className="text-xs text-muted-foreground">Choose Light, Dark, or match your system.</div>
            </div>
            <ThemeToggle variant="full" />
          </div>

          <div className="card-soft space-y-3 p-5">
            <div>
              <div className="text-sm font-semibold">Backup & restore</div>
              <div className="text-xs text-muted-foreground">Local-only snapshot of your data.</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => {
                window.open(`${API_BASE_URL}/settings/database/backup`, "_blank");
                toast.success("Backup Downloaded", { description: "POS SQLite database snapshot saved." });
              }}>
                <Download className="mr-2 size-4" /> Backup
              </Button>
              <Button variant="outline" onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".db";
                input.onchange = async (e: any) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const confirmRestore = window.confirm(
                    `Are you sure you want to restore from "${file.name}"?\nThis will overwrite ALL current transactions, products, and customer databases.`
                  );
                  if (!confirmRestore) return;
                  
                  const toastId = toast.loading("Restoring POS database...");
                  const formData = new FormData();
                  formData.append("database", file);
                  
                  try {
                    const res = await fetch(`${API_BASE_URL}/settings/database/restore`, {
                      method: "POST",
                      body: formData
                    });
                    const json = await res.json();
                    if (json.success) {
                      toast.success("Database restored successfully!", {
                        id: toastId,
                        description: "Reloading Orion POS engine..."
                      });
                      setTimeout(() => window.location.reload(), 1500);
                    } else {
                      toast.error(json.error || "Failed to restore database", { id: toastId });
                    }
                  } catch (err) {
                    toast.error("Network error restoring database", { id: toastId });
                  }
                };
                input.click();
              }}>
                <Upload className="mr-2 size-4" /> Restore
              </Button>
            </div>
          </div>

          {/* PDF Storage Management Card */}
          <div className="card-soft space-y-4 p-5">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                <HardDrive className="size-4 text-primary" /> PDF Storage Management
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Manage space and retention of invoice PDFs.</div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-muted/40 p-2.5 border border-border/20">
                  <div className="text-muted-foreground">Total PDFs</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">{storageStats?.totalPdfs ?? 0}</div>
                </div>
                <div className="rounded-xl bg-muted/40 p-2.5 border border-border/20">
                  <div className="text-muted-foreground">Storage Used</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">{storageStats?.storageUsedMb ?? 0} MB</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Retention Period</Label>
                <Select
                  value={storageStats?.retentionPeriod || "90 Days"}
                  onValueChange={async (val) => {
                    try {
                      const res = await fetch(`${API_BASE_URL}/settings`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pdf_retention_period: val }),
                      });
                      if (res.ok) {
                        toast.success(`Retention period set to ${val}`);
                        loadStorageStats();
                      }
                    } catch (e) {
                      toast.error("Failed to update retention period.");
                    }
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30 Days">30 Days</SelectItem>
                    <SelectItem value="90 Days">90 Days (default)</SelectItem>
                    <SelectItem value="180 Days">180 Days</SelectItem>
                    <SelectItem value="Forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground border border-border/20">
                <div className="flex justify-between">
                  <span>Last Cleanup:</span>
                  <span className="font-semibold text-foreground">
                    {storageStats?.lastCleanup && storageStats.lastCleanup !== "Never"
                      ? formatToKolkataDateTime(storageStats.lastCleanup)
                      : "Never"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Next Cleanup:</span>
                  <span className="font-semibold text-foreground">
                    {storageStats?.nextCleanup
                      ? formatToKolkataDateTime(storageStats.nextCleanup)
                      : "Never"}
                  </span>
                </div>
              </div>

              {storageStats?.cleanupLogs && storageStats.cleanupLogs.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Cleanup History Logs</Label>
                  <div className="max-h-24 overflow-y-auto rounded-xl border border-border/20 bg-muted/20 p-2 text-[10px] font-mono space-y-1">
                    {storageStats.cleanupLogs.map((log: string, i: number) => (
                      <div key={i} className="text-muted-foreground truncate border-b border-border/10 pb-0.5 last:border-0">{log}</div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                type="button"
                className="w-full rounded-xl h-10 border-rose-500/20 text-rose-500 hover:bg-rose-500/5 hover:text-rose-500"
                disabled={cleaningStorage}
                onClick={async () => {
                  setCleaningStorage(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/settings/storage/cleanup`, { method: "POST" });
                    const json = await res.json();
                    if (json.success) {
                      toast.success(json.message);
                      loadStorageStats();
                    } else {
                      toast.error("Cleanup failed.");
                    }
                  } catch (e) {
                    toast.error("Failed to trigger cleanup.");
                  } finally {
                    setCleaningStorage(false);
                  }
                }}
              >
                {cleaningStorage ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Clean Now
              </Button>
            </div>
          </div>

          {/* Google Sheets Sync Card */}
          <div className="card-soft space-y-4 p-5">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Cloud className="size-4 text-primary" /> Google Sheets Sync
                </div>
                {syncStatus && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    syncStatus.status === "Green" ? "bg-emerald-500/10 text-emerald-500" :
                    syncStatus.status === "Yellow" ? "bg-amber-500/10 text-amber-500" :
                    "bg-rose-500/10 text-rose-500"
                  }`}>
                    {syncStatus.status === "Green" && <CheckCircle2 className="size-3" />}
                    {syncStatus.status === "Red" && <AlertCircle className="size-3" />}
                    {syncStatus.status === "Yellow" && <RefreshCw className="size-3 animate-spin" />}
                    {syncStatus.status === "Green" ? "Connected" : syncStatus.status === "Yellow" ? "Syncing..." : "Failed / Offline"}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Sync sales, customers, products to Google sheets.</div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Google Service Account Email</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={syncStatus?.serviceAccount || "Loading..."}
                    className="h-10 rounded-xl bg-muted/40 font-mono text-xs select-all"
                  />
                  <Button
                    variant="outline"
                    type="button"
                    size="sm"
                    className="rounded-xl h-10 px-3"
                    disabled={!syncStatus?.serviceAccount || syncStatus.serviceAccount === "Not Configured"}
                    onClick={() => {
                      navigator.clipboard.writeText(syncStatus.serviceAccount);
                      toast.success("Copied to clipboard", {
                        description: "Service account email copied successfully."
                      });
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  ⚠️ Share your Google Sheet with this email address as an "Editor" to authorize sync.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Google Sheet ID</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter spreadsheet ID"
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-10 px-3"
                    disabled={testingConnection || !sheetId}
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
                          toast.success("Connection Successful!", {
                            description: "Linked spreadsheet is reachable."
                          });
                        } else {
                          toast.error("Connection Failed", {
                            description: data.error || "Ensure Sheet permissions allow access."
                          });
                        }
                      } catch (e) {
                        toast.error("Network error testing connection.");
                      } finally {
                        setTestingConnection(false);
                      }
                    }}
                  >
                    {testingConnection ? <Loader2 className="size-4 animate-spin" /> : "Test"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-border/40 mt-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Enable background sync</Label>
                  <div className="text-[10px] text-muted-foreground">Auto sync on checkout & CRUD</div>
                </div>
                <button
                  onClick={() => setSyncEnabled(!syncEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${syncEnabled ? "bg-foreground" : "bg-muted"}`}
                >
                  <span className={`inline-block size-4 transform rounded-full bg-background transition-transform ${syncEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {syncStatus && (
                <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground border border-border/20">
                  <div className="flex justify-between">
                    <span>Google Connected:</span>
                    <span className={`font-semibold ${syncStatus.enabled ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {syncStatus.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection Status:</span>
                    <span className={`font-semibold ${
                      syncStatus.status === "Green" ? "text-emerald-500" :
                      syncStatus.status === "Yellow" ? "text-amber-500" : "text-rose-500"
                    }`}>
                      {syncStatus.status === "Green" ? "Online / Idle" : syncStatus.status === "Yellow" ? "Syncing..." : "Failed / Misconfigured"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sheet ID:</span>
                    <span className="font-semibold text-foreground truncate max-w-[160px]">{syncStatus.sheetId || "Not Set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Sync Queue:</span>
                    <span className="font-semibold text-foreground">{syncStatus.pendingJobs} jobs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed Sync Queue:</span>
                    <span className={`font-semibold ${syncStatus.failedJobs > 0 ? "text-rose-500 font-bold" : "text-foreground"}`}>
                      {syncStatus.failedJobs} jobs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Synced:</span>
                    <span className="font-semibold text-foreground">
                      {syncStatus.lastSync && syncStatus.lastSync !== "Never" ? formatToKolkataDateTime(syncStatus.lastSync) : "Never"}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-10"
                  disabled={syncingNow || !syncEnabled || !sheetId}
                  onClick={async () => {
                    setSyncingNow(true);
                    try {
                      await fetch(`${API_BASE_URL}/sync/trigger`, { method: "POST" });
                      toast.success("Google Sync triggered!");
                    } catch (e) {
                      toast.error("Failed to trigger sync.");
                    } finally {
                      setSyncingNow(false);
                    }
                  }}
                >
                  {syncingNow ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5" />}
                  Sync Now
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-10 border-rose-500/20 text-rose-500 hover:bg-rose-500/5 hover:text-rose-500"
                  disabled={retryingFailed || !syncStatus?.failedJobs}
                  onClick={async () => {
                    setRetryingFailed(true);
                    try {
                      await fetch(`${API_BASE_URL}/sync/retry`, { method: "POST" });
                      toast.success("Retrying failed sync items...");
                    } catch (e) {
                      toast.error("Failed to retry.");
                    } finally {
                      setRetryingFailed(false);
                    }
                  }}
                >
                  Retry Failed
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Receipt */}
        <div className="card-soft space-y-4 p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Receipt</div>
              <div className="text-xs text-muted-foreground">Live preview updates as you edit.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              s.setReceiptHeader("Thank you for shopping with us");
              s.setReceiptFooter("*** Thank you — visit again ***");
              s.setWhatsappFooter("Thank you for shopping. Visit Again.");
              toast.success("Reset to defaults");
            }}>
              <RotateCcw className="mr-1.5 size-3.5" /> Reset
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Row label="Receipt header">
                <Textarea rows={2} value={s.receiptHeader} onChange={(e) => s.setReceiptHeader(e.target.value)} />
              </Row>
              <Row label="Receipt footer">
                <Textarea rows={2} value={s.receiptFooter} onChange={(e) => s.setReceiptFooter(e.target.value)} />
              </Row>
              <Row label="WhatsApp message footer">
                <Textarea rows={2} value={s.whatsappFooter} onChange={(e) => s.setWhatsappFooter(e.target.value)} />
              </Row>
              <Row label="UPI ID">
                <Input value={s.upiId} onChange={(e) => s.setUpiId(e.target.value)} className="h-11 rounded-xl" />
              </Row>
              <Row label="QR position">
                <RadioGroup
                  value={s.qrPosition}
                  onValueChange={(v) => s.setQrPosition(v as "Top" | "Bottom")}
                  className="grid grid-cols-2 gap-2"
                >
                  {(["Top", "Bottom"] as const).map((p) => (
                    <label
                      key={p}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-muted/40"
                    >
                      <RadioGroupItem value={p} />
                      {p}
                    </label>
                  ))}
                </RadioGroup>
              </Row>
            </div>
            <div className="grid place-items-center rounded-2xl bg-muted/30 p-4">
              <ReceiptPreview />
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="card-soft space-y-4 p-5 md:col-span-2">
          <div>
            <div className="text-sm font-semibold">Active role</div>
            <div className="text-xs text-muted-foreground">Switch roles to preview the permission matrix.</div>
          </div>
          <RadioGroup
            value={s.role}
            onValueChange={(v) => s.setRole(v as Role)}
            className="grid gap-3 sm:grid-cols-3"
          >
            {(["Admin", "Manager", "Cashier"] as const).map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 hover:bg-muted/40 has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-muted/50"
              >
                <RadioGroupItem value={r} className="mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">{r}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r === "Admin" && "Full access: billing, inventory, reports, settings."}
                    {r === "Manager" && "Everything except account deletion & GSTIN edits."}
                    {r === "Cashier" && "Billing + basic inventory only. No settings, no profit reports."}
                  </div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
