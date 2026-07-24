import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Save, Users, Store, ShieldCheck, Mail, Phone, MapPin, Globe, CreditCard, FileText, Calendar, Clock } from "lucide-react";
import { useApp } from "@/lib/store";
import { getOrganizationCurrent, updateOrganizationCurrent } from "@/lib/api";
import { toast } from "sonner";
import { inr } from "@/lib/format";

export function OrganizationSettingsSection() {
  const currentRole = useApp((s) => s.role);
  const isOwnerOrAdmin = ["admin", "owner"].includes((currentRole || "").toLowerCase());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [financialYear, setFinancialYear] = useState("2026-2027");
  const [receiptInfo, setReceiptInfo] = useState("");

  // Stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    disabledUsers: 0,
    totalStores: 0,
    activeStores: 0,
  });

  const fetchOrgData = async () => {
    try {
      setLoading(true);
      const data = await getOrganizationCurrent();
      if (data) {
        setName(data.name || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setGstNumber(data.gst_number || "");
        setPanNumber(data.pan_number || "");
        setAddress(data.address || "");
        setLogoUrl(data.logo_url || "");
        setCurrency(data.currency || "INR");
        setTimezone(data.timezone || "Asia/Kolkata");
        setInvoicePrefix(data.invoice_prefix || "INV-");
        setFinancialYear(data.financial_year || "2026-2027");
        setReceiptInfo(data.receipt_info || "");

        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load organization settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrAdmin) {
      toast.error("Only Organization Owners or Admins can modify settings");
      return;
    }
    if (!name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    try {
      setSaving(true);
      await updateOrganizationCurrent({
        name,
        phone,
        email,
        gstNumber,
        panNumber,
        address,
        logoUrl,
        currency,
        timezone,
        invoicePrefix,
        financialYear,
        receiptInfo,
      });
      toast.success("Organization profile updated successfully");
      fetchOrgData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update organization");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-soft p-5 space-y-6">
      <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-base font-bold text-foreground flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> Organization Administration & Profile
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Configure multi-store organization identity, billing parameters, and company profile.
          </div>
        </div>

        {isOwnerOrAdmin && (
          <Button onClick={handleSave} disabled={saving || loading} className="rounded-xl h-9 px-4 text-xs font-semibold gap-1.5">
            <Save className="size-4" /> {saving ? "Saving…" : "Save Organization Profile"}
          </Button>
        )}
      </div>

      {/* USER & STORE SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Stores</span>
            <Store className="size-3.5 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">{stats.totalStores}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {stats.activeStores} Active Store Outlets
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Users</span>
            <Users className="size-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-foreground">{stats.totalUsers}</div>
          <div className="text-[10px] text-muted-foreground font-medium">
            {stats.activeUsers} Active / {stats.disabledUsers} Disabled
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Active Users</span>
            <ShieldCheck className="size-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.activeUsers}</div>
          <div className="text-[10px] text-muted-foreground">Team Members Authorized</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Disabled Users</span>
            <Badge variant="outline" className="text-[9px] py-0 border-destructive/30 text-destructive">Deactivated</Badge>
          </div>
          <div className="text-xl font-bold text-destructive">{stats.disabledUsers}</div>
          <div className="text-[10px] text-muted-foreground">Access Suspended</div>
        </div>
      </div>

      {/* BUSINESS PROFILE FORM */}
      <form onSubmit={handleSave} className="space-y-4 pt-2">
        <div className="text-xs font-bold text-foreground border-b border-border/40 pb-1.5 flex items-center gap-1.5">
          <FileText className="size-3.5 text-primary" /> Business Profile & Information
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Business / Organization Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apka Bill Enterprise Retail"
              className="rounded-xl h-9 text-xs"
              disabled={!isOwnerOrAdmin}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Business Logo URL</Label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="rounded-xl h-9 text-xs"
              disabled={!isOwnerOrAdmin}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">GSTIN / Tax Number</Label>
            <Input
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="27ABCDE1234F1Z5"
              className="rounded-xl h-9 text-xs font-mono"
              disabled={!isOwnerOrAdmin}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">PAN Number (Optional)</Label>
            <Input
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
              placeholder="ABCDE1234F"
              className="rounded-xl h-9 text-xs font-mono uppercase"
              disabled={!isOwnerOrAdmin}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Primary Contact Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="rounded-xl h-9 text-xs"
              disabled={!isOwnerOrAdmin}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Primary Contact Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@company.com"
              className="rounded-xl h-9 text-xs"
              disabled={!isOwnerOrAdmin}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Registered Headquarters Address</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Plot 45, Industrial Estate, Phase II, Pune 411001"
            className="rounded-xl h-9 text-xs"
            disabled={!isOwnerOrAdmin}
          />
        </div>

        <div className="text-xs font-bold text-foreground border-b border-border/40 pb-1.5 pt-3 flex items-center gap-1.5">
          <Globe className="size-3.5 text-primary" /> Billing Parameters & Localization
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Invoice Sequence Prefix</Label>
            <Input
              value={invoicePrefix}
              onChange={(e) => setInvoicePrefix(e.target.value)}
              placeholder="INV-"
              className="rounded-xl h-9 text-xs font-mono"
              disabled={!isOwnerOrAdmin}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Financial Year</Label>
            <Input
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              placeholder="2026-2027"
              className="rounded-xl h-9 text-xs font-mono"
              disabled={!isOwnerOrAdmin}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Operating Currency</Label>
            <Select value={currency} onValueChange={setCurrency} disabled={!isOwnerOrAdmin}>
              <SelectTrigger className="rounded-xl h-9 text-xs">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="INR">INR (₹ Indian Rupee)</SelectItem>
                <SelectItem value="USD">USD ($ US Dollar)</SelectItem>
                <SelectItem value="EUR">EUR (€ Euro)</SelectItem>
                <SelectItem value="AED">AED (Dh UAE Dirham)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone} disabled={!isOwnerOrAdmin}>
              <SelectTrigger className="rounded-xl h-9 text-xs">
                <SelectValue placeholder="Timezone" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <Label className="text-xs font-semibold">Receipt Header & Compliance Info</Label>
          <Textarea
            value={receiptInfo}
            onChange={(e) => setReceiptInfo(e.target.value)}
            placeholder="Default receipt compliance disclosures, tax terms, or return policies"
            className="rounded-xl text-xs min-h-[60px]"
            disabled={!isOwnerOrAdmin}
          />
        </div>

        {isOwnerOrAdmin && (
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving || loading} className="rounded-xl h-9 px-5 text-xs font-semibold gap-1.5">
              <Save className="size-4" /> {saving ? "Saving…" : "Save Organization Profile"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
