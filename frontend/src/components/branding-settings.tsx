import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { updateSettingsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  MessageSquare,
  QrCode,
  Palette,
  Eye,
  CheckCircle,
  Upload,
  Globe,
  Phone,
  Mail,
  Receipt,
  FileCode,
  Trash2,
  Printer,
  Share2,
} from "lucide-react";

function readFileAsOptimizedLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read selected image file."));
    reader.onload = (evt) => {
      const rawDataUrl = evt.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error("Empty logo file."));
        return;
      }
      // Keep small logos & SVGs directly; resize large raster uploads cleanly for thermal/API efficiency
      if (file.type === "image/svg+xml" || file.size <= 150 * 1024 || typeof document === "undefined") {
        resolve(rawDataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 512;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.max(1, Math.round(w * ratio));
            h = Math.max(1, Math.round(h * ratio));
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function BrandingSettings() {
  const queryClient = useQueryClient();
  const s = useApp();
  const [savingBranding, setSavingBranding] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<
    "invoice" | "receipt" | "whatsapp" | "pdf"
  >("invoice");
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const payload: Record<string, string> = {
        shop_name: s.shopName || "",
        shop_gstin: s.gstin || "",
        shop_address: s.storeAddress || "",
        shop_phone: s.storePhone || "",
        shop_email: s.storeEmail || "",
        logo: s.logo || "",
        shop_upi_id: s.upiId || "",
        tagline: s.tagline || "",
        website: s.website || "",
        invoice_header: s.invoiceHeader || "",
        invoice_footer: s.invoiceFooter || "",
        receipt_footer: s.receiptFooter || "",
        terms_and_conditions: s.termsAndConditions || "",
        whatsapp_signature: s.whatsappSignature || "",
        primary_color: s.primaryColor || "#2563eb",
      };

      await updateSettingsApi(payload);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });

      // Update localStorage mirror after confirmed backend persistence
      localStorage.setItem("orion_shop_name", s.shopName);
      localStorage.setItem("orion_gstin", s.gstin);
      if (s.logo) localStorage.setItem("orion_logo", s.logo);
      else localStorage.removeItem("orion_logo");
      if (s.tagline) localStorage.setItem("orion_tagline", s.tagline);
      if (s.storeAddress) localStorage.setItem("orion_address", s.storeAddress);
      if (s.storePhone) localStorage.setItem("orion_phone", s.storePhone);
      if (s.storeEmail) localStorage.setItem("orion_email", s.storeEmail);
      if (s.website) localStorage.setItem("orion_website", s.website);
      if (s.invoiceHeader) localStorage.setItem("orion_invoice_header", s.invoiceHeader);
      if (s.invoiceFooter) localStorage.setItem("orion_invoice_footer", s.invoiceFooter);
      if (s.receiptFooter) localStorage.setItem("orion_receipt_footer", s.receiptFooter);
      if (s.thankYouMessage) localStorage.setItem("orion_thank_you_message", s.thankYouMessage);
      if (s.termsAndConditions) localStorage.setItem("orion_terms", s.termsAndConditions);
      if (s.returnPolicy) localStorage.setItem("orion_return_policy", s.returnPolicy);
      if (s.whatsappSignature) localStorage.setItem("orion_whatsapp_signature", s.whatsappSignature);
      if (s.upiId) localStorage.setItem("orion_upi_id", s.upiId);
      if (s.accountHolderName) localStorage.setItem("orion_account_holder", s.accountHolderName);
      if (s.bankDetails) localStorage.setItem("orion_bank_details", s.bankDetails);
      if (s.primaryColor) localStorage.setItem("orion_primary_color", s.primaryColor);

      toast.success("Business branding saved successfully!", {
        description:
          "Changes persisted to store settings for future Invoices, Receipts, PDFs, and WhatsApp shares.",
      });
    } catch (err: any) {
      toast.error("Failed to save branding settings: " + (err?.message || err));
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div className="card-soft space-y-6 p-5 md:col-span-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="text-base font-bold text-foreground flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> Branding & Business Identity
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Single source of truth for shop identity, document headers, UPI payment branding, and
            colors.
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSaveBranding}
          disabled={savingBranding}
          className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground px-5 shadow-sm"
        >
          <CheckCircle className="size-3.5 mr-1.5" />{" "}
          {savingBranding ? "Saving..." : "Save Branding Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Branding Form Sections */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Shop Identity */}
          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Building2 className="size-4 text-primary" /> 1. Shop Identity
            </div>

            {/* Logo Upload Box */}
            <div className="space-y-3 rounded-xl border border-border/50 bg-background p-4 shadow-sm">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Shop Brand Logo</span>
                {s.logo ? (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle className="size-3" /> Active Logo Configured
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">No Logo Uploaded</span>
                )}
              </Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {s.logo ? (
                  <div className="relative group size-20 rounded-xl border border-border bg-muted/10 p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    <img
                      src={s.logo}
                      alt="Shop Logo Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="size-20 rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-muted-foreground text-[10px] shrink-0">
                    <Upload className="size-6 mb-1 text-primary/70" /> No Logo
                  </div>
                )}

                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Upload / Replace Button */}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const prevLogo = s.logo;
                          try {
                            const optimized = await readFileAsOptimizedLogoDataUrl(file);
                            s.setLogo(optimized);
                            localStorage.setItem("orion_logo", optimized);
                            await updateSettingsApi({ logo: optimized });
                            await queryClient.invalidateQueries({ queryKey: ["settings"] });
                            toast.success("Brand logo saved for this store!", {
                              description:
                                "Logo will automatically appear on printed Receipts, PDFs, and Shared Invoices when enabled.",
                            });
                          } catch (err: any) {
                            s.setLogo(prevLogo);
                            if (prevLogo) localStorage.setItem("orion_logo", prevLogo);
                            else localStorage.removeItem("orion_logo");
                            toast.error("Failed to save store logo: " + (err?.message || err));
                          }
                        }}
                      />
                      <span className="inline-flex items-center justify-center rounded-xl text-xs font-bold h-9 px-3.5 border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 shadow-sm transition-all cursor-pointer">
                        <Upload className="size-3.5 mr-1.5" />{" "}
                        {s.logo ? "Replace Logo" : "Upload Logo"}
                      </span>
                    </label>

                    {/* Preview Logo Button */}
                    {s.logo && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLogoPreviewOpen(true)}
                        className="rounded-xl h-9 text-xs font-semibold"
                      >
                        <Eye className="size-3.5 mr-1.5 text-blue-500" /> Preview Logo
                      </Button>
                    )}

                    {/* Delete Logo Button */}
                    {s.logo && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const prevLogo = s.logo;
                          try {
                            s.setLogo("");
                            localStorage.removeItem("orion_logo");
                            await updateSettingsApi({ logo: "" });
                            await queryClient.invalidateQueries({ queryKey: ["settings"] });
                            toast.info("Brand logo deleted.");
                          } catch (err: any) {
                            s.setLogo(prevLogo);
                            if (prevLogo) localStorage.setItem("orion_logo", prevLogo);
                            toast.error("Failed to delete store logo: " + (err?.message || err));
                          }
                        }}
                        className="rounded-xl h-9 text-xs text-rose-600 border-rose-500/20 hover:bg-rose-500/10 font-semibold"
                      >
                        <Trash2 className="size-3.5 mr-1.5" /> Delete Logo
                      </Button>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    Supports PNG, JPG, WebP, or SVG. Uploaded logo automatically cascades to Web
                    Invoices, Thermal Receipts, Server PDFs, and WhatsApp Shared Invoices.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Shop Name *</Label>
                <Input
                  value={s.shopName}
                  onChange={(e) => s.setShopName(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                  placeholder="e.g. Apka Bill Store"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Business Tagline</Label>
                <Input
                  value={s.tagline || ""}
                  onChange={(e) => s.setTagline?.(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                  placeholder="e.g. Quality & Trust Since 2018"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">GSTIN / Tax ID</Label>
                <Input
                  value={s.gstin}
                  onChange={(e) => s.setGstin(e.target.value)}
                  className="rounded-xl h-9 text-xs font-mono"
                  placeholder="e.g. 27ABCDE1234F1Z5"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  value={s.storePhone}
                  onChange={(e) => s.setStorePhone(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Email Address</Label>
                <Input
                  value={s.storeEmail}
                  onChange={(e) => s.setStoreEmail(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                  placeholder="hello@shop.com"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Website</Label>
                <Input
                  value={s.website || ""}
                  onChange={(e) => s.setWebsite?.(e.target.value)}
                  className="rounded-xl h-9 text-xs font-mono"
                  placeholder="https://www.myshop.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Store Address</Label>
              <Textarea
                rows={2}
                value={s.storeAddress}
                onChange={(e) => s.setStoreAddress(e.target.value)}
                className="rounded-xl text-xs leading-relaxed"
                placeholder="Shop address, street, city, state, postal code"
              />
            </div>
          </div>

          {/* Section 2: Document Branding */}
          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
              <FileText className="size-4 text-blue-500" /> 2. Document Branding (Invoices &
              Receipts)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Invoice Header Notice</Label>
                <Input
                  value={s.invoiceHeader || s.receiptHeader}
                  onChange={(e) => {
                    s.setInvoiceHeader?.(e.target.value);
                    s.setReceiptHeader(e.target.value);
                  }}
                  className="rounded-xl h-9 text-xs"
                  placeholder="e.g. Tax Invoice / Cash Memo"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Default Thank You Message</Label>
                <Input
                  value={s.thankYouMessage || "Thank you for shopping with us!"}
                  onChange={(e) => s.setThankYouMessage?.(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                  placeholder="Thank you for shopping with us!"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Invoice & PDF Footer</Label>
              <Textarea
                rows={2}
                value={s.invoiceFooter || s.receiptFooter}
                onChange={(e) => {
                  s.setInvoiceFooter?.(e.target.value);
                  s.setReceiptFooter(e.target.value);
                }}
                className="rounded-xl text-xs"
                placeholder="*** Thank you — Visit Again ***"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Terms & Conditions</Label>
                <Textarea
                  rows={2}
                  value={
                    s.termsAndConditions ||
                    "1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction."
                  }
                  onChange={(e) => s.setTermsAndConditions?.(e.target.value)}
                  className="rounded-xl text-xs leading-relaxed font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Return / Refund Policy</Label>
                <Textarea
                  rows={2}
                  value={
                    s.returnPolicy ||
                    "Returns accepted within 7 days with original invoice receipt."
                  }
                  onChange={(e) => s.setReturnPolicy?.(e.target.value)}
                  className="rounded-xl text-xs leading-relaxed font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: WhatsApp Branding */}
          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
              <MessageSquare className="size-4 text-green-500" /> 3. WhatsApp Branding
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">WhatsApp Signature</Label>
              <Textarea
                rows={2}
                value={
                  s.whatsappSignature ||
                  `Thanks for shopping with ${s.shopName}\nRegards,\n${s.shopName}`
                }
                onChange={(e) => s.setWhatsappSignature?.(e.target.value)}
                className="rounded-xl text-xs font-mono"
                placeholder={`Thanks for shopping with ${s.shopName}`}
              />
              <p className="text-[10px] text-muted-foreground">
                Appended automatically at the end of shared WhatsApp document messages.
              </p>
            </div>
          </div>

          {/* Section 4: Payment Branding */}
          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
              <QrCode className="size-4 text-purple-500" /> 4. Payment Branding (UPI & Bank)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">UPI VPA Handle</Label>
                <Input
                  value={s.upiId}
                  onChange={(e) => s.setUpiId(e.target.value)}
                  className="rounded-xl h-9 text-xs font-mono"
                  placeholder="e.g. shopname@upi"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Account Holder Name</Label>
                <Input
                  value={s.accountHolderName || s.shopName}
                  onChange={(e) => s.setAccountHolderName?.(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                  placeholder="Account owner or business name"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Bank Account Details (Future / Invoices)
              </Label>
              <Input
                value={s.bankDetails || "HDFC Bank · A/C: 5010099881234 · IFSC: HDFC0001234"}
                onChange={(e) => s.setBankDetails?.(e.target.value)}
                className="rounded-xl h-9 text-xs font-mono"
                placeholder="Bank Name · Account Number · IFSC Code"
              />
            </div>
          </div>

          {/* Section 5: Brand Color & Theme */}
          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Palette className="size-4 text-amber-500" /> 5. Theme & Primary Brand Color
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-1 flex-1">
                <Label className="text-xs font-semibold">Primary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={s.primaryColor || "#10b981"}
                    onChange={(e) => s.setPrimaryColor?.(e.target.value)}
                    className="size-9 rounded-xl border border-border p-1 cursor-pointer bg-background"
                  />
                  <Input
                    value={s.primaryColor || "#10b981"}
                    onChange={(e) => s.setPrimaryColor?.(e.target.value)}
                    className="rounded-xl h-9 text-xs font-mono w-32"
                  />
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <Label className="text-xs font-semibold">Secondary Accent Color (Future)</Label>
                <Input
                  readOnly
                  value="System Auto-Balanced"
                  className="rounded-xl h-9 text-xs bg-muted/40 font-mono text-muted-foreground select-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 cols: Multi-Tab Live Preview */}
        <div className="lg:col-span-5 space-y-3 flex flex-col justify-start">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Eye className="size-4 text-primary" /> Live Document Preview
            </div>
            <Badge variant="outline" className="text-[9px] font-mono">
              Real-time Updates
            </Badge>
          </div>

          {/* Preview Tab Buttons */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-muted/30 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActivePreviewTab("invoice")}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                activePreviewTab === "invoice"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Invoice
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab("receipt")}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                activePreviewTab === "receipt"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Receipt
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab("whatsapp")}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                activePreviewTab === "whatsapp"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab("pdf")}
              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                activePreviewTab === "pdf"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              PDF
            </button>
          </div>

          {/* Active Preview Frame */}
          <div className="rounded-2xl border border-border bg-background p-4 shadow-sm min-h-[380px] font-sans text-xs space-y-4">
            {activePreviewTab === "invoice" && (
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-border pb-3">
                  <div>
                    <div className="font-bold text-sm text-foreground">{s.shopName}</div>
                    {s.tagline && (
                      <div className="text-[11px] text-muted-foreground italic">{s.tagline}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">{s.storeAddress}</div>
                    <div className="text-[10px] text-muted-foreground">GSTIN: {s.gstin}</div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] border-primary text-primary"
                    >
                      {s.invoiceHeader || "TAX INVOICE"}
                    </Badge>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      #INV-00124
                    </div>
                  </div>
                </div>

                <div className="space-y-1 font-mono text-[11px] border-b border-border pb-3">
                  <div className="flex justify-between font-bold text-foreground">
                    <span>1x Wireless Mouse</span>
                    <span>₹999.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground">
                    <span>2x Mechanical Keyboard</span>
                    <span>₹1,451.00</span>
                  </div>
                </div>

                <div className="flex justify-between items-center font-bold text-xs">
                  <span>Grand Total</span>
                  <span className="text-primary text-sm font-black">₹2,450.00</span>
                </div>

                {s.upiId && (
                  <div className="rounded-xl bg-muted/20 border border-border p-2.5 text-[10px] font-mono space-y-0.5">
                    <div className="font-bold text-foreground">UPI Payment: {s.upiId}</div>
                    <div className="text-muted-foreground">{s.bankDetails}</div>
                  </div>
                )}

                <div className="text-center text-[10px] text-muted-foreground pt-2 border-t border-border/40 space-y-1">
                  <div>{s.thankYouMessage || "Thank you for shopping with us!"}</div>
                  <div className="font-mono text-[9px]">{s.invoiceFooter || s.receiptFooter}</div>
                </div>
              </div>
            )}

            {activePreviewTab === "receipt" && (
              <div className="font-mono text-[11px] space-y-3 bg-muted/10 p-3 rounded-xl border border-dashed border-border">
                <div className="text-center space-y-0.5">
                  <div className="font-bold text-sm text-foreground uppercase">{s.shopName}</div>
                  {s.tagline && (
                    <div className="text-[10px] italic text-muted-foreground">{s.tagline}</div>
                  )}
                  <div className="text-[9px] text-muted-foreground">{s.storeAddress}</div>
                  <div className="text-[9px] font-bold">GSTIN: {s.gstin}</div>
                </div>
                <div className="border-t border-b border-dashed border-border py-1.5 space-y-1">
                  <div className="flex justify-between">
                    <span>1x Wireless Mouse</span>
                    <span>₹999.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2x Mechanical Keyboard</span>
                    <span>₹1,451.00</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-xs">
                  <span>TOTAL:</span>
                  <span>₹2,450.00</span>
                </div>
                <div className="text-center text-[9px] text-muted-foreground border-t border-dashed border-border pt-2">
                  <div>{s.receiptFooter}</div>
                  <div>UPI: {s.upiId}</div>
                </div>
              </div>
            )}

            {activePreviewTab === "whatsapp" && (
              <div className="space-y-3 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                <div className="whitespace-pre-wrap leading-relaxed">
                  {`Hello Rahul Sharma,\n\nThank you for shopping with ${s.shopName || "Apka Bill Store"}!\n\nInvoice: INV-00124\nDate: 25 Jul 2026\n\nTotal Amount: ₹2,450.00\nPaid: ₹2,450.00\nBalance: ₹0.00\n\nYour invoice image is attached.\n\n${s.whatsappSignature || "Thank you for choosing us!"}`}
                </div>
              </div>
            )}

            {activePreviewTab === "pdf" && (
              <div className="space-y-3 border border-border p-4 rounded-xl shadow-xs text-xs">
                <div className="flex justify-between items-center border-b pb-2">
                  <div className="font-bold text-primary">{s.shopName}</div>
                  <Badge variant="outline" className="text-[9px]">
                    PDF Document
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>Address: {s.storeAddress}</div>
                  <div>
                    GSTIN: {s.gstin} · Phone: {s.storePhone}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 p-2 font-mono text-[10px] space-y-1">
                  <div className="font-bold text-foreground">Terms & Conditions:</div>
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {s.termsAndConditions || "Standard sales terms apply."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* High-Resolution Logo Preview Modal */}
      <Dialog open={logoPreviewOpen} onOpenChange={setLogoPreviewOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="size-5 text-blue-500" /> Shop Brand Logo High-Res Preview
            </DialogTitle>
            <DialogDescription className="text-xs">
              Inspection view showing active logo rendering and target document cascading rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Checkerboard Pattern Background for Transparency Check */}
            <div className="relative rounded-2xl border border-border p-8 flex items-center justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] bg-muted/30 min-h-[180px]">
              {s.logo ? (
                <img
                  src={s.logo}
                  alt="Brand Logo High Res"
                  className="max-h-36 max-w-full object-contain drop-shadow-md"
                />
              ) : (
                <div className="text-xs text-muted-foreground italic">No Logo Configured</div>
              )}
            </div>

            {/* Target Cascading Checklist */}
            <div className="space-y-2 rounded-xl bg-muted/20 p-3.5 border border-border/50 text-xs">
              <div className="font-bold text-foreground text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CheckCircle className="size-4 text-emerald-500" /> Automatic Logo Cascading
                Destinations
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Web & Printable Invoices
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> 58mm/80mm Thermal
                  Receipts
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Server PDF Export Engine
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> WhatsApp Shared Online
                  Link
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
