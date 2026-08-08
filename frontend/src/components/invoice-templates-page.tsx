import { useState, useEffect } from "react";
import { FileText, CheckCircle, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { DEFAULT_RECEIPT_TEMPLATES, saveActiveTemplateConfig, type TemplatePreset } from "@/lib/receipt-template";
import { InvoiceTemplateRenderer } from "@/components/invoice-template-renderer";
import { API_BASE_URL, apiFetch } from "@/lib/api";

export function InvoiceTemplatesPage() {
  const s = useApp();
  const [invPrefix, setInvPrefix] = useState(() => localStorage.getItem("orion_inv_prefix") || "INV-");
  const [pdfInvoiceTemplate, setPdfInvoiceTemplate] = useState("Professional A4");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync settings state from backend database API on mount
  useEffect(() => {
    apiFetch(`${API_BASE_URL}/settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          const cfg = d.data;
          if (cfg.shop_name) s.setShopName(cfg.shop_name);
          if (cfg.shop_gstin) s.setGstin(cfg.shop_gstin);
          if (cfg.shop_address) s.setStoreAddress(cfg.shop_address);
          if (cfg.shop_phone) s.setStorePhone(cfg.shop_phone);
          if (cfg.shop_email) s.setStoreEmail(cfg.shop_email);
          if (cfg.logo) s.setLogo(cfg.logo);
          if (cfg.shop_upi_id) s.setUpiId(cfg.shop_upi_id);
          if (cfg.inv_prefix) setInvPrefix(cfg.inv_prefix);
          if (cfg.receipt_footer) s.setReceiptFooter(cfg.receipt_footer);
          if (cfg.receipt_template) s.setReceiptTemplate(cfg.receipt_template as any);
          if (cfg.pdf_invoice_template) setPdfInvoiceTemplate(cfg.pdf_invoice_template);
          if (cfg.primary_color && s.setPrimaryColor) s.setPrimaryColor(cfg.primary_color);
          if (cfg.invoice_header && s.setInvoiceHeader) s.setInvoiceHeader(cfg.invoice_header);
          if (cfg.invoice_footer && s.setInvoiceFooter) s.setInvoiceFooter(cfg.invoice_footer);
          if (cfg.terms_and_conditions && s.setTermsAndConditions) s.setTermsAndConditions(cfg.terms_and_conditions);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      localStorage.setItem("orion_inv_prefix", invPrefix);
      if (s.receiptFooter) localStorage.setItem("orion_receipt_footer", s.receiptFooter);

      const payload = {
        inv_prefix: invPrefix,
        receipt_footer: s.receiptFooter,
        receipt_template: s.receiptTemplate,
        pdf_invoice_template: pdfInvoiceTemplate,
        primary_color: s.primaryColor,
        invoice_header: s.invoiceHeader,
        invoice_footer: s.invoiceFooter,
        terms_and_conditions: s.termsAndConditions,
        require_customer_before_checkout: s.requireCustomerBeforeCheckout ? "1" : "0",
      };

      const res = await apiFetch(`${API_BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setIsDirty(false);
        toast.success("Invoice Template configuration saved successfully!");
      } else {
        toast.error(data.message || "Failed to save settings to database.");
      }
    } catch (err: any) {
      toast.error("Failed to connect to backend server: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const templatePresets: TemplatePreset[] = [
    "Classic",
    "Modern",
    "Minimal",
    "Retail",
    "Wholesale",
    "GST Professional",
    "Restaurant",
    "Medical",
    "Fashion",
    "Compact",
    "Thermal",
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Top Header & Save Button Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Invoice Templates & Layout Designer
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Choose invoice templates, customize headers, footers, brand colors, and preview live sample receipts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-emerald-500 text-emerald-600 bg-emerald-500/10 hidden sm:inline-flex"
          >
            🟢 Live Dynamic Preview
          </Badge>
          <Button
            onClick={handleSaveSettings}
            disabled={saving || !isDirty}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="card-soft p-5 space-y-6">
        {/* Separation Section 1: Receipt / Thermal Template */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">1. Thermal / Receipt Template (Controls View Receipt & POS Thermal Print)</Label>
            <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
              Selected: {s.receiptTemplate}
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {templatePresets.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => {
                  const config = DEFAULT_RECEIPT_TEMPLATES[tpl];
                  saveActiveTemplateConfig(config);
                  s.setReceiptTemplate(tpl as any);
                  setIsDirty(true);
                  toast.success(`Active Receipt Template switched to ${tpl}!`);
                }}
                className={`card-soft p-3.5 text-center cursor-pointer transition-all rounded-xl ${
                  s.receiptTemplate === tpl
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "hover:border-primary/50"
                }`}
              >
                <div className="text-xl mb-1">
                  {tpl === "Classic"
                    ? "📜"
                    : tpl === "Modern"
                    ? "✨"
                    : tpl === "Minimal"
                    ? "⚡"
                    : tpl === "Retail"
                    ? "🛍️"
                    : tpl === "Wholesale"
                    ? "📦"
                    : tpl === "GST Professional"
                    ? "🏛️"
                    : tpl === "Restaurant"
                    ? "🍽️"
                    : tpl === "Medical"
                    ? "💊"
                    : tpl === "Fashion"
                    ? "👗"
                    : tpl === "Compact"
                    ? "📱"
                    : "🖨️"}
                </div>
                <div className="text-xs font-bold text-foreground truncate">{tpl}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {tpl === "Wholesale" || tpl === "GST Professional"
                    ? "Thermal Wide"
                    : tpl === "Compact"
                    ? "58mm Mini"
                    : "80mm Standard"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Separation Section 2: PDF Invoice Template */}
        <div className="space-y-2 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">2. PDF Invoice Template (Controls Dedicated A4 PDF Downloads & WhatsApp PDF)</Label>
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 font-bold">
              Active: {pdfInvoiceTemplate}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: "Professional A4",
                name: "Professional A4",
                icon: "📄",
                desc: "Dark slate header, modern typography, vector layout with logo & QR",
              },
              {
                id: "Standard A4",
                name: "Standard A4",
                icon: "📋",
                desc: "Classic blue business invoice header with clean itemized breakdown",
              },
              {
                id: "GST Invoice A4",
                name: "GST Invoice A4",
                icon: "🏛️",
                desc: "Emerald green header, GST tax breakdown table & compliance notes",
              },
            ].map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setPdfInvoiceTemplate(tpl.id);
                  setIsDirty(true);
                  toast.success(`Active PDF Invoice Template set to ${tpl.name}!`);
                }}
                className={`card-soft p-4 text-left cursor-pointer transition-all rounded-xl border ${
                  pdfInvoiceTemplate === tpl.id
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{tpl.icon}</div>
                  <div>
                    <div className="text-xs font-bold text-foreground">{tpl.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{tpl.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/20 border border-border/50">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Invoice Header Notice</Label>
            <Input
              value={s.invoiceHeader || ""}
              onChange={(e) => {
                s.setInvoiceHeader?.(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. TAX INVOICE"
              className="h-8 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Invoice Prefix</Label>
            <Input
              value={invPrefix}
              onChange={(e) => {
                setInvPrefix(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. INV-"
              className="h-8 rounded-lg text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Receipt Footer Notice</Label>
            <Input
              value={s.receiptFooter || ""}
              onChange={(e) => {
                s.setReceiptFooter(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. Thank you for shopping with us!"
              className="h-8 rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs font-semibold">Terms & Conditions / Invoice Footer</Label>
            <Input
              value={s.invoiceFooter || s.termsAndConditions || ""}
              onChange={(e) => {
                s.setInvoiceFooter?.(e.target.value);
                s.setTermsAndConditions?.(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. Goods once sold can be exchanged within 7 days."
              className="h-8 rounded-lg text-xs"
            />
          </div>

          {/* Brand Color Selector */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Brand Accent Color</Label>
            <div className="flex items-center gap-1.5 pt-0.5">
              {["#2563eb", "#059669", "#7c3aed", "#d97706", "#dc2626", "#1e293b"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    s.setPrimaryColor?.(c);
                    setIsDirty(true);
                  }}
                  className={`size-6 rounded-full border-2 transition-transform ${
                    (s.primaryColor || "#2563eb") === c
                      ? "scale-110 border-foreground shadow-sm"
                      : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Require Customer Selection Toggle */}
          <div className="space-y-1 sm:col-span-2 pt-1 flex items-center justify-between border-t border-border/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Require Customer Selection</Label>
              <div className="text-[10px] text-muted-foreground">
                When disabled, checkout automatically resolves to System Walk-in Customer.
              </div>
            </div>
            <input
              type="checkbox"
              checked={s.requireCustomerBeforeCheckout}
              onChange={(e) => {
                s.setRequireCustomerBeforeCheckout(e.target.checked);
                setIsDirty(true);
              }}
              className="size-4 accent-primary cursor-pointer rounded"
            />
          </div>
        </div>

        {/* Dynamic Live Preview Canvas Specimen */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="size-4 text-emerald-500" /> Dynamic Live Specimen ({s.receiptTemplate} Theme)
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              Format: <span className="font-bold text-foreground">{invPrefix}00125</span>
            </span>
          </div>

          <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-lg max-w-xl mx-auto transition-all text-black">
            <InvoiceTemplateRenderer
              templateName={s.receiptTemplate}
              receipt={{
                shop: {
                  name: s.shopName || "Apka Bill Store",
                  address: s.storeAddress || "123 POS Center, Salt Lake, Kolkata",
                  phone: s.storePhone || "8285068670",
                  gstin: s.gstin || "27AAAAA1111A1Z1",
                  logo: s.logo,
                  upiId: s.upiId || "apkabill@upi",
                },
                invoiceNumber: `${invPrefix}00125`,
                date: "01/08/2026",
                time: "02:45 PM",
                cashier: "Admin",
                customer: {
                  name: s.requireCustomerBeforeCheckout ? "Rahul Verma (Required)" : "Walk-in Customer",
                  phone: "9876543210",
                },
                items: [
                  { name: "Basmati Rice 5kg", qty: 2, price: 450, lineTotal: 900, gst: 5 },
                  { name: "Sunflower Cooking Oil 1L", qty: 3, price: 165, lineTotal: 495, gst: 12 },
                  { name: "Organic Whole Wheat Atta 10kg", qty: 1, price: 420, lineTotal: 420, gst: 0 },
                ],
                subtotal: 1815,
                gst: 104.4,
                discount: 50,
                grandTotal: 1869.4,
                paymentMethod: "UPI",
                thankYouMessage: s.termsAndConditions || s.invoiceFooter || "Goods once sold cannot be returned without original receipt.",
              } as any}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
