import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  Activity,
  Plus,
  Trash2,
  Zap,
  RefreshCw,
  Clock,
  Wifi,
  Usb,
  Bluetooth,
  Monitor,
  Smartphone,
  Sparkles,
  Building2,
  Layers,
} from "lucide-react";
import { printerService, PrinterProfile, DEFAULT_PRINTER_PROFILES, printerProfileService, validatePrinterProfile } from "@/lib/printer.service";
import { ThermalPrinterBridge, BluetoothDeviceItem } from "@/lib/thermal-printer-plugin";
import { toast } from "sonner";

interface PrinterSettingsSectionProps {
  currentStore?: any;
  onSaveSuccess?: () => void;
}

export function PrinterSettingsSection({ currentStore, onSaveSuccess }: PrinterSettingsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Store's Profiles List & Active Profile
  const [profiles, setProfiles] = useState<PrinterProfile[]>(DEFAULT_PRINTER_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>("prof-counter-01");

  // Profile Dialog State for Add/Edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PrinterProfile | null>(null);

  const [btDevices, setBtDevices] = useState<BluetoothDeviceItem[]>([]);
  const [scanningBt, setScanningBt] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleScanBluetoothDevices = async () => {
    setScanningBt(true);
    try {
      const devices = await ThermalPrinterBridge.listBluetoothDevices();
      setBtDevices(devices);
      if (devices.length === 0) {
        toast.info("No paired Bluetooth printers found. Please pair your KP307 printer in Android Bluetooth Settings first.");
      } else {
        toast.success(`Found ${devices.length} paired Bluetooth device(s).`);
      }
    } catch (err: any) {
      toast.error("Failed to list Bluetooth devices: " + (err.message || err));
    } finally {
      setScanningBt(false);
    }
  };

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState(printerService.getDiagnostics(undefined, currentStore));

  // Load Settings from Backend per Store Context
  useEffect(() => {
    loadStorePrinterSettings();
  }, [currentStore?.id]);

  const loadStorePrinterSettings = async () => {
    setLoading(true);
    try {
      const { profiles: loadedProfiles, activeProfile: loadedActive } = await printerProfileService.getStorePrinterConfig(currentStore?.id);
      setProfiles(loadedProfiles);
      setActiveProfileId(loadedActive.id);
      setDiagnostics(printerService.getDiagnostics(loadedActive, currentStore));
    } catch (err) {
      console.error("Error loading store printer settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0] || DEFAULT_PRINTER_PROFILES[0];

  useEffect(() => {
    setDiagnostics(printerService.getDiagnostics(activeProfile, currentStore));
  }, [activeProfile, activeProfileId, currentStore]);

  const handleSavePrinterSettings = async (updatedProfiles: PrinterProfile[], activeId: string) => {
    for (const prof of updatedProfiles) {
      const val = validatePrinterProfile(prof);
      if (!val.valid) {
        toast.error(`Invalid profile "${prof.name}": ${val.error}`);
        return;
      }
    }

    setSaving(true);
    try {
      const ok = await printerProfileService.saveStorePrinterConfig(updatedProfiles, activeId, currentStore?.id);
      if (!ok) throw new Error("Could not persist configuration to store database");

      toast.success(`Printer settings saved for ${currentStore?.name || "current store"}!`);
      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      toast.error("Failed to save printer settings: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await ThermalPrinterBridge.testConnection({
        connectionType: activeProfile.connectionType as any,
        bluetoothMac: activeProfile.bluetoothMac,
        ip: activeProfile.printerIp,
        port: activeProfile.printerPort || 9100,
      });
      if (res.success) {
        toast.success(res.message || "Connection to KP307 printer verified!");
      } else {
        toast.error(res.message || "Printer connection test failed.");
      }
    } catch (err: any) {
      toast.error("Connection test error: " + (err.message || err));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSetDefaultProfile = (id: string) => {
    const updated = profiles.map((p) => ({
      ...p,
      isDefault: p.id === id,
    }));
    setProfiles(updated);
    setActiveProfileId(id);
    handleSavePrinterSettings(updated, id);
  };

  const handleOpenAddDialog = () => {
    const newProf: PrinterProfile = {
      id: `prof-${Date.now().toString().slice(-4)}`,
      name: "New Printer Profile",
      isDefault: profiles.length === 0,
      connectionType: "bluetooth",
      paperWidth: "58mm",
      receiptTemplate: "Classic",
      autoCut: true,
      showLogo: true,
      showQr: true,
      showBarcode: true,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      charactersPerLine: 32,
      printerDpi: 203,
      printableWidthMm: 48,
    };
    setEditingProfile(newProf);
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (prof: PrinterProfile) => {
    setEditingProfile({ ...prof });
    setDialogOpen(true);
  };

  const handleSaveProfileFromDialog = () => {
    if (!editingProfile) return;

    const val = validatePrinterProfile(editingProfile);
    if (!val.valid) {
      toast.error(`Invalid profile: ${val.error}`);
      return;
    }

    const exists = profiles.some((p) => p.id === editingProfile.id);
    let updated: PrinterProfile[];
    if (exists) {
      updated = profiles.map((p) => (p.id === editingProfile.id ? editingProfile : p));
    } else {
      updated = [...profiles, editingProfile];
    }
    setProfiles(updated);
    setDialogOpen(false);
    handleSavePrinterSettings(updated, activeProfileId);
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      toast.error("At least one printer profile is required per store.");
      return;
    }
    const updated = profiles.filter((p) => p.id !== id);
    setProfiles(updated);
    const nextActiveId = activeProfileId === id ? updated[0].id : activeProfileId;
    setActiveProfileId(nextActiveId);
    handleSavePrinterSettings(updated, nextActiveId);
  };

  const handleRunRealTestPrint = async () => {
    setTesting(true);
    try {
      const ok = await printerService.runTestPrint(activeProfile, currentStore);
      setDiagnostics(printerService.getDiagnostics(activeProfile, currentStore));
      if (ok) {
        toast.success("REAL Test Print dispatched to hardware via active adapter!");
      }
    } catch (e: any) {
      toast.error("Test print error: " + (e.message || e));
    } finally {
      setTesting(false);
    }
  };

  const updateActiveProfileField = (key: keyof PrinterProfile, value: any) => {
    const updated = profiles.map((p) => {
      if (p.id === activeProfile.id) {
        return { ...p, [key]: value };
      }
      return p;
    });
    setProfiles(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-card p-5 border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Printer Platform & Hardware</h2>
              <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider border-primary/30 text-primary">
                Store Isolated ({currentStore?.name || "Main Store"})
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure hardware profiles, paper formats, ESC/POS adapters, and live diagnostics per store.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleRunRealTestPrint}
            disabled={testing || loading}
            variant="outline"
            className="rounded-xl text-xs font-semibold gap-2 border-border"
          >
            {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-amber-500" />}
            {testing ? "Testing Hardware..." : "⚡ REAL Test Print"}
          </Button>
          <Button
            onClick={() => handleSavePrinterSettings(profiles, activeProfileId)}
            disabled={saving || loading}
            className="rounded-xl text-xs font-semibold px-4 gap-2"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Store Setup"}
          </Button>
        </div>
      </div>

      {/* Grid: Left Profiles & Config, Right Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Profiles & Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Printer Profiles List Card */}
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold">Store Printer Profiles ({profiles.length})</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Multi-profile hardware configs (Counter, Office, Kitchen, Packing)
                </CardDescription>
              </div>
              <Button onClick={handleOpenAddDialog} size="sm" variant="outline" className="rounded-xl text-xs gap-1 border-border">
                <Plus className="h-3.5 w-3.5" /> Add Profile
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {profiles.map((prof) => {
                const isActive = prof.id === activeProfileId;
                return (
                  <div
                    key={prof.id}
                    onClick={() => setActiveProfileId(prof.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {prof.connectionType === "browser" && <Monitor className="h-4 w-4" />}
                        {prof.connectionType === "usb" && <Usb className="h-4 w-4" />}
                        {prof.connectionType === "bluetooth" && <Bluetooth className="h-4 w-4" />}
                        {(prof.connectionType === "lan" || prof.connectionType === "escpos") && <Wifi className="h-4 w-4" />}
                        {prof.connectionType === "android_pos" && <Smartphone className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{prof.name}</span>
                          {prof.isDefault && (
                            <Badge className="text-[9px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                              Active Store Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {prof.connectionType.toUpperCase()} · {prof.paperWidth} · Template: {prof.receiptTemplate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {!prof.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetDefaultProfile(prof.id)}
                          className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Make Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEditDialog(prof)}
                        className="h-7 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Edit
                      </Button>
                      {profiles.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteProfile(prof.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Active Profile Configuration Form */}
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Profile Parameters: <span className="text-primary">{activeProfile.name}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Adapter type, paper width, layout design, margins & toggles
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-border">
                  ID: {activeProfile.id}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Connection & Paper Width Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Connection Adapter / Protocol</Label>
                  <Select
                    value={activeProfile.connectionType}
                    onValueChange={(val: any) => updateActiveProfileField("connectionType", val)}
                  >
                    <SelectTrigger className="rounded-xl bg-background border-border text-xs">
                      <SelectValue placeholder="Select Connection" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="android_pos">📱 Built-in Android POS Printer (Sunmi/iMin/PAX)</SelectItem>
                      <SelectItem value="usb">🔌 USB ESC/POS Thermal Printer (Direct WebUSB / Android Native)</SelectItem>
                      <SelectItem value="bluetooth">📡 Bluetooth ESC/POS Thermal Printer (KP307 / Android Native)</SelectItem>
                      <SelectItem value="lan">🌐 LAN / Network TCP Printer (Port 9100)</SelectItem>
                      <SelectItem value="browser">🌐 Browser Fallback (Silent Hidden Frame)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Paper Roll Width</Label>
                  <Select
                    value={activeProfile.paperWidth}
                    onValueChange={(val: any) => {
                      const updatedProf = { ...activeProfile, paperWidth: val };
                      if (val === "58mm") {
                        updatedProf.printableWidthMm = 48;
                        updatedProf.charactersPerLine = 32;
                      } else if (val === "80mm") {
                        updatedProf.printableWidthMm = 72;
                        updatedProf.charactersPerLine = 48;
                      } else if (val === "A4") {
                        updatedProf.printableWidthMm = 190;
                        updatedProf.charactersPerLine = 80;
                      }
                      const updatedList = profiles.map((p) => (p.id === activeProfile.id ? updatedProf : p));
                      setProfiles(updatedList);
                    }}
                  >
                    <SelectTrigger className="rounded-xl bg-background border-border text-xs">
                      <SelectValue placeholder="Select Paper Roll Width" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">58mm (2-inch Compact Thermal Roll)</SelectItem>
                      <SelectItem value="80mm">80mm (3-inch Standard Thermal Roll)</SelectItem>
                      <SelectItem value="A4">A4 (Standard Full Sheet Document)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional Connection Details Parameters */}
              {(activeProfile.connectionType === "lan" || activeProfile.connectionType === "escpos") && (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Network Printer IP Address</Label>
                      <Input
                        placeholder="e.g. 192.168.1.150"
                        value={activeProfile.printerIp || ""}
                        onChange={(e) => updateActiveProfileField("printerIp", e.target.value)}
                        className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">TCP Raw Port</Label>
                      <Input
                        type="number"
                        placeholder="9100"
                        value={activeProfile.printerPort || 9100}
                        onChange={(e) => updateActiveProfileField("printerPort", Number(e.target.value))}
                        className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl text-xs h-8 border-border gap-1.5"
                  >
                    {testingConnection ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5 text-blue-500" />}
                    Test Network Connection
                  </Button>
                </div>
              )}

              {activeProfile.connectionType === "bluetooth" && (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Bluetooth Device Identifier / MAC Address</Label>
                    <Button
                      onClick={handleScanBluetoothDevices}
                      disabled={scanningBt}
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-primary hover:text-primary/80 px-2 gap-1"
                    >
                      {scanningBt ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Bluetooth className="h-3 w-3" />}
                      Scan Paired Devices
                    </Button>
                  </div>

                  {btDevices.length > 0 ? (
                    <Select
                      value={activeProfile.bluetoothMac || ""}
                      onValueChange={(val) => {
                        const dev = btDevices.find((d) => d.address === val);
                        updateActiveProfileField("bluetoothMac", val);
                        if (dev) updateActiveProfileField("bluetoothDeviceName", dev.name);
                      }}
                    >
                      <SelectTrigger className="rounded-xl bg-background border-border text-xs h-8">
                        <SelectValue placeholder="Select Paired Bluetooth Printer" />
                      </SelectTrigger>
                      <SelectContent>
                        {btDevices.map((d) => (
                          <SelectItem key={d.address} value={d.address}>
                            {d.name} ({d.address})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="e.g. 00:11:22:33:44:55 (MAC Address)"
                      value={activeProfile.bluetoothMac || activeProfile.bluetoothDeviceName || ""}
                      onChange={(e) => {
                        updateActiveProfileField("bluetoothMac", e.target.value);
                        updateActiveProfileField("bluetoothDeviceName", e.target.value);
                      }}
                      className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                    />
                  )}

                  <Button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl text-xs h-8 border-border gap-1.5"
                  >
                    {testingConnection ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Bluetooth className="h-3.5 w-3.5 text-blue-500" />}
                    Test Bluetooth Connection
                  </Button>
                </div>
              )}

              {/* Hardware Parameters */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Characters per Line</Label>
                  <Input
                    type="number"
                    value={activeProfile.charactersPerLine || (activeProfile.paperWidth === "58mm" ? 32 : 48)}
                    onChange={(e) => updateActiveProfileField("charactersPerLine", Number(e.target.value))}
                    className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Printable Width (mm)</Label>
                  <Input
                    type="number"
                    value={activeProfile.printableWidthMm || (activeProfile.paperWidth === "58mm" ? 48 : 72)}
                    onChange={(e) => updateActiveProfileField("printableWidthMm", Number(e.target.value))}
                    className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Resolution (DPI)</Label>
                  <Input
                    type="number"
                    value={activeProfile.printerDpi || 203}
                    onChange={(e) => updateActiveProfileField("printerDpi", Number(e.target.value))}
                    className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                  />
                </div>
              </div>

              {activeProfile.connectionType === "usb" && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">USB Vendor ID (Hex / Optional)</Label>
                    <Input
                      placeholder="e.g. 0x0fe6"
                      value={activeProfile.usbVendorId || ""}
                      onChange={(e) => updateActiveProfileField("usbVendorId", e.target.value)}
                      className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">USB Product ID (Hex / Optional)</Label>
                    <Input
                      placeholder="e.g. 0x811e"
                      value={activeProfile.usbProductId || ""}
                      onChange={(e) => updateActiveProfileField("usbProductId", e.target.value)}
                      className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                    />
                  </div>
                </div>
              )}

              {activeProfile.connectionType === "android_pos" && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <span>📱 Uses native Android POS thermal printer SDK (Sunmi / iMin / PAX / Z91) via Android Web Bridge.</span>
                </div>
              )}

              {/* Receipt Template & Auto Cut Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Receipt Layout Design</Label>
                  <Select
                    value={activeProfile.receiptTemplate}
                    onValueChange={(val: any) => updateActiveProfileField("receiptTemplate", val)}
                  >
                    <SelectTrigger className="rounded-xl bg-background border-border text-xs">
                      <SelectValue placeholder="Select Template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Classic">Classic POS Standard</SelectItem>
                      <SelectItem value="Compact">Compact Thermal (Space Saver)</SelectItem>
                      <SelectItem value="Modern">Modern Minimalist</SelectItem>
                      <SelectItem value="Retail">Retail Store Full Itemization</SelectItem>
                      <SelectItem value="Minimal">Minimal Ticket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 border border-border">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Automatic Paper Cut</Label>
                    <p className="text-[10px] text-muted-foreground">Generates ESC/POS cut command (`GS V 0`)</p>
                  </div>
                  <Switch
                    checked={activeProfile.autoCut}
                    onCheckedChange={(chk) => updateActiveProfileField("autoCut", chk)}
                  />
                </div>
              </div>

              {/* Display Element Toggles */}
              <div className="pt-2 border-t border-border">
                <Label className="text-xs font-semibold mb-3 block">Receipt Components & Branding Elements</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 border border-border">
                    <span className="text-xs text-muted-foreground">Store Logo</span>
                    <Switch
                      checked={activeProfile.showLogo}
                      onCheckedChange={(chk) => updateActiveProfileField("showLogo", chk)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 border border-border">
                    <span className="text-xs text-muted-foreground">UPI / Verification QR</span>
                    <Switch
                      checked={activeProfile.showQr}
                      onCheckedChange={(chk) => updateActiveProfileField("showQr", chk)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 p-2.5 border border-border">
                    <span className="text-xs text-muted-foreground">Invoice Barcode</span>
                    <Switch
                      checked={activeProfile.showBarcode}
                      onCheckedChange={(chk) => updateActiveProfileField("showBarcode", chk)}
                    />
                  </div>
                </div>
              </div>

              {/* Margins Calibration Section */}
              <div className="pt-2 border-t border-border">
                <Label className="text-xs font-semibold mb-3 block">Margin Calibration (mm)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Top Margin</span>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={activeProfile.marginTop}
                      onChange={(e) => updateActiveProfileField("marginTop", Number(e.target.value))}
                      className="rounded-xl bg-background border-border text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Bottom Margin</span>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={activeProfile.marginBottom}
                      onChange={(e) => updateActiveProfileField("marginBottom", Number(e.target.value))}
                      className="rounded-xl bg-background border-border text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Left Margin</span>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={activeProfile.marginLeft}
                      onChange={(e) => updateActiveProfileField("marginLeft", Number(e.target.value))}
                      className="rounded-xl bg-background border-border text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Right Margin</span>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={activeProfile.marginRight}
                      onChange={(e) => updateActiveProfileField("marginRight", Number(e.target.value))}
                      className="rounded-xl bg-background border-border text-xs h-8"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 col): Hardware Diagnostics & Status */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Live Hardware Diagnostics</span>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Real-time spooler metrics & adapter status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connection Status Badge */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Adapter Status</span>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1 px-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {diagnostics.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Adapter Type</span>
                    <span className="font-semibold text-foreground uppercase">{diagnostics.connectionType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Paper Format</span>
                    <span className="font-semibold text-foreground">{diagnostics.paperWidth}</span>
                  </div>
                </div>
              </div>

              {/* Spooler Stats */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <div className="flex justify-between text-xs py-1 border-b border-border">
                  <span className="text-muted-foreground">Active Store</span>
                  <span className="font-bold text-foreground">{diagnostics.storeName}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-border">
                  <span className="text-muted-foreground">Total Printed Jobs</span>
                  <span className="font-mono font-bold text-foreground">{diagnostics.totalPrintCount}</span>
                </div>
                <div className="flex justify-between text-xs py-1 border-b border-border">
                  <span className="text-muted-foreground">Avg Latency</span>
                  <span className="font-mono font-bold text-foreground">{diagnostics.averagePrintTimeMs} ms</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-muted-foreground">Last Print Timestamp</span>
                  <span className="font-mono text-[11px] text-foreground">{diagnostics.lastPrintTimestamp || "Never"}</span>
                </div>
              </div>

              {/* Diagnostic Log */}
              {diagnostics.lastError ? (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1 text-xs text-red-500">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="h-3.5 w-3.5" /> Recent Hardware Exception
                  </div>
                  <p className="text-[11px] font-mono leading-tight">{diagnostics.lastError}</p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Hardware Pipeline Clean
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Adapter buffer initialized. Zero queue blockages detected.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ESC/POS Code Spec Banner */}
          <Card className="rounded-2xl border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs">
              <Sparkles className="h-4 w-4" /> Hardware ESC/POS Support
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Orion POS generates universal ESC/POS byte buffers for KP307, Epson, TVS, Sunmi, Star Micronics, and Xprinter thermal hardware.
            </p>
          </Card>
        </div>
      </div>

      {/* Edit / Add Profile Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingProfile?.id && profiles.some((p) => p.id === editingProfile.id) ? "Edit Printer Profile" : "Add Printer Profile"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define custom printer profile parameters for this store.
            </DialogDescription>
          </DialogHeader>

          {editingProfile && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Profile Name</Label>
                <Input
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  placeholder="e.g. Counter Thermal 80mm"
                  className="rounded-xl bg-background border-border text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Connection Protocol</Label>
                  <Select
                    value={editingProfile.connectionType}
                    onValueChange={(val: any) => setEditingProfile({ ...editingProfile, connectionType: val })}
                  >
                    <SelectTrigger className="rounded-xl bg-background border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="android_pos">Built-in POS</SelectItem>
                      <SelectItem value="usb">USB Thermal</SelectItem>
                      <SelectItem value="bluetooth">Bluetooth (KP307)</SelectItem>
                      <SelectItem value="lan">LAN / Network</SelectItem>
                      <SelectItem value="browser">Browser Silent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Paper Roll Width</Label>
                  <Select
                    value={editingProfile.paperWidth}
                    onValueChange={(val: any) => {
                      const updated = { ...editingProfile, paperWidth: val };
                      if (val === "58mm") {
                        updated.printableWidthMm = 48;
                        updated.charactersPerLine = 32;
                      } else if (val === "80mm") {
                        updated.printableWidthMm = 72;
                        updated.charactersPerLine = 48;
                      } else if (val === "A4") {
                        updated.printableWidthMm = 190;
                        updated.charactersPerLine = 80;
                      }
                      setEditingProfile(updated);
                    }}
                  >
                    <SelectTrigger className="rounded-xl bg-background border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">58mm Roll (2-inch)</SelectItem>
                      <SelectItem value="80mm">80mm Roll (3-inch)</SelectItem>
                      <SelectItem value="A4">A4 Sheet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Chars / Line</Label>
                  <Input
                    type="number"
                    value={editingProfile.charactersPerLine ?? (editingProfile.paperWidth === "58mm" ? 32 : 48)}
                    onChange={(e) => setEditingProfile({ ...editingProfile, charactersPerLine: Number(e.target.value) })}
                    className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Printable (mm)</Label>
                  <Input
                    type="number"
                    value={editingProfile.printableWidthMm ?? (editingProfile.paperWidth === "58mm" ? 48 : 72)}
                    onChange={(e) => setEditingProfile({ ...editingProfile, printableWidthMm: Number(e.target.value) })}
                    className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">DPI</Label>
                  <Input
                    type="number"
                    value={editingProfile.printerDpi ?? 203}
                    onChange={(e) => setEditingProfile({ ...editingProfile, printerDpi: Number(e.target.value) })}
                    className="rounded-xl bg-background border-border text-xs h-8 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 border border-border">
                <span className="text-xs font-semibold">Auto Paper Cut</span>
                <Switch
                  checked={editingProfile.autoCut}
                  onCheckedChange={(chk) => setEditingProfile({ ...editingProfile, autoCut: chk })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl text-xs border-border">
              Cancel
            </Button>
            <Button onClick={handleSaveProfileFromDialog} className="rounded-xl text-xs font-semibold">
              Save Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
