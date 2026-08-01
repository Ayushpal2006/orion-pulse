import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  WHATSAPP_TEMPLATES_REGISTRY,
  renderWhatsAppTemplate,
  resolvePlaceholderValues,
  type WhatsAppTemplateConfig,
} from "@/lib/whatsapp-templates";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { Eye, RotateCcw, Send, CheckCircle, MessageSquare, Phone, FileText, Sparkles, Building2 } from "lucide-react";

interface WhatsAppTemplateManagerProps {
  currentStore?: any;
}

export function WhatsAppTemplateManager({ currentStore }: WhatsAppTemplateManagerProps) {
  const [activeTab, setActiveTab] = useState<string>(WHATSAPP_TEMPLATES_REGISTRY[0].id);
  const [templatesState, setTemplatesState] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Real Invoices & Record selection state
  const [realInvoices, setRealInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("latest");
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<any | null>(null);

  // Dialog & Test Flow State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testMobile, setTestMobile] = useState("9876543210");
  const [mobileError, setMobileError] = useState("");

  // Load saved templates from localStorage or fallback to defaults
  useEffect(() => {
    const loaded: Record<string, string> = {};
    WHATSAPP_TEMPLATES_REGISTRY.forEach((tpl) => {
      const saved = localStorage.getItem(`orion_wa_template_${tpl.id}`);
      loaded[tpl.id] = saved || tpl.defaultTemplate;
    });
    setTemplatesState(loaded);
    fetchRealInvoices();
  }, [currentStore?.id]);

  const fetchRealInvoices = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/sales?limit=10`);
      if (res.ok) {
        const json = await res.json();
        const sales = json.data || json.sales || [];
        if (Array.isArray(sales) && sales.length > 0) {
          setRealInvoices(sales);
          setSelectedInvoiceData(sales[0]);
        }
      }
    } catch (e) {
      console.warn("Could not fetch real sales invoices for template preview:", e);
    }
  };

  const currentConfig = WHATSAPP_TEMPLATES_REGISTRY.find((t) => t.id === activeTab) || WHATSAPP_TEMPLATES_REGISTRY[0];
  const currentText = templatesState[currentConfig.id] ?? currentConfig.defaultTemplate;

  // Handle invoice selection change
  const handleSelectInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    if (id === "latest" || !id) {
      setSelectedInvoiceData(realInvoices[0] || null);
    } else {
      const found = realInvoices.find((inv) => String(inv.id || inv.invoiceNumber) === id);
      setSelectedInvoiceData(found || null);
    }
  };

  // Resolve Live Preview Data
  const livePlaceholderMap = resolvePlaceholderValues(selectedInvoiceData || currentConfig.sampleData, currentStore);
  const previewText = renderWhatsAppTemplate(currentText, livePlaceholderMap);

  const handleTemplateChange = (val: string) => {
    setTemplatesState((prev) => ({
      ...prev,
      [currentConfig.id]: val,
    }));
  };

  const handleInsertPlaceholder = (placeholder: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const updated = currentText.substring(0, start) + placeholder + currentText.substring(end);
    handleTemplateChange(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const handleSaveAll = () => {
    Object.entries(templatesState).forEach(([id, val]) => {
      localStorage.setItem(`orion_wa_template_${id}`, val);
    });
    toast.success("WhatsApp templates saved successfully", {
      description: "Custom templates are active for this store.",
    });
  };

  const handleResetCurrent = () => {
    const defaultVal = currentConfig.defaultTemplate;
    setTemplatesState((prev) => ({
      ...prev,
      [currentConfig.id]: defaultVal,
    }));
    localStorage.removeItem(`orion_wa_template_${currentConfig.id}`);
    toast.info(`Reset "${currentConfig.name}" to default template`);
  };

  const handleOpenTestDialog = () => {
    setMobileError("");
    setDialogOpen(true);
  };

  const handleSendTestInvoice = () => {
    const cleanDigits = testMobile.replace(/\D/g, "");
    if (cleanDigits.length !== 10) {
      setMobileError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setMobileError("");
    const formattedPhone = `91${cleanDigits}`;
    const encodedText = encodeURIComponent(previewText);
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;

    window.open(waUrl, "_blank");
    toast.success(`Opening WhatsApp for test invoice dispatch to +91 ${cleanDigits}!`);
    setDialogOpen(false);
  };

  const availablePlaceholders = [
    "{customer_name}",
    "{supplier_name}",
    "{shop_name}",
    "{invoice_number}",
    "{purchase_number}",
    "{quotation_number}",
    "{amount}",
    "{balance_due}",
    "{date}",
    "{invoice_link}",
    "{payment_link}",
  ];

  return (
    <div className="card-soft space-y-5 p-5 md:col-span-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <div className="text-base font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="size-5 text-green-500" /> WhatsApp Message Templates
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Customize document share templates with real-time placeholder resolution & live testing.
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSaveAll}
          className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground px-4 shadow-sm"
        >
          <CheckCircle className="size-3.5 mr-1.5" /> Save All Templates
        </Button>
      </div>

      {/* Document Type Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {WHATSAPP_TEMPLATES_REGISTRY.map((tpl) => {
          const isActive = tpl.id === activeTab;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setActiveTab(tpl.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <span>{tpl.name}</span>
              {tpl.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tpl.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 cols: Interactive Editor */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-foreground">
              Editing: <span className="text-primary">{currentConfig.name}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">{currentConfig.description}</div>
          </div>

          <Textarea
            ref={textareaRef}
            rows={7}
            value={currentText}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="rounded-2xl font-mono text-xs leading-relaxed p-3.5 bg-background focus:ring-2 focus:ring-primary/20"
            placeholder="Enter template message text..."
          />

          {/* Placeholders Toolbar */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Click placeholder to insert at cursor:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availablePlaceholders.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => handleInsertPlaceholder(ph)}
                  className="bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/40 border border-border/60 px-2 py-0.5 rounded-lg font-mono text-[10px] text-muted-foreground transition-all cursor-pointer"
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetCurrent}
              className="rounded-xl h-8 text-xs border-border hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30"
            >
              <RotateCcw className="size-3 mr-1.5" /> Reset to Default
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenTestDialog}
              className="rounded-xl h-8 text-xs border-green-500/40 text-green-600 dark:text-green-400 hover:bg-green-500/10 gap-1.5 font-semibold"
            >
              <Send className="size-3.5 text-green-500" /> Send Test Message
            </Button>
          </div>
        </div>

        {/* Right 5 cols: Live Preview */}
        <div className="lg:col-span-5 space-y-3 flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Eye className="size-4 text-emerald-500" /> Live Message Preview
              </div>
              <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                Instant Resolution
              </Badge>
            </div>

            {/* Record Selector for Preview Context */}
            {realInvoices.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Previewing Data From:</span>
                <Select value={selectedInvoiceId} onValueChange={handleSelectInvoice}>
                  <SelectTrigger className="h-7 text-[11px] rounded-lg bg-background/80 border-emerald-500/30">
                    <SelectValue placeholder="Select invoice for preview" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Latest Real Invoice ({realInvoices[0]?.invoiceNumber || "INV-001"})</SelectItem>
                    {realInvoices.map((inv) => (
                      <SelectItem key={inv.id || inv.invoiceNumber} value={String(inv.id || inv.invoiceNumber)}>
                        {inv.invoiceNumber} — {inv.customerName || inv.customer_name || "Customer"} (₹{inv.total || inv.grandTotal || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-xl bg-background/90 dark:bg-neutral-900/90 border border-emerald-500/20 p-3.5 text-xs font-mono whitespace-pre-wrap text-foreground leading-relaxed shadow-inner max-h-64 overflow-y-auto">
              {previewText}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground pt-2 border-t border-emerald-500/20 flex items-center gap-1">
            <Sparkles className="size-3 text-amber-500 shrink-0" />
            <span>Placeholders resolve dynamically with active store & document values.</span>
          </div>
        </div>
      </div>

      {/* Dialog for Real-World Test Message Dispatch */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Send className="size-4 text-green-500" /> Send Test WhatsApp Invoice
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Dispatch rendered message with real invoice parameters to test phone number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Mobile Number Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Recipient Mobile Number</Label>
              <div className="flex items-center gap-2">
                <span className="flex h-9 items-center justify-center rounded-xl border border-border bg-muted/50 px-3 text-xs font-bold text-muted-foreground">
                  +91
                </span>
                <Input
                  type="tel"
                  maxLength={10}
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 10-digit mobile number"
                  className="rounded-xl text-xs h-9 bg-background"
                />
              </div>
              {mobileError && <span className="text-[11px] font-semibold text-rose-500">{mobileError}</span>}
            </div>

            {/* Document / Invoice Context Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Invoice Data Source</Label>
              <Select value={selectedInvoiceId} onValueChange={handleSelectInvoice}>
                <SelectTrigger className="rounded-xl text-xs h-9 bg-background">
                  <SelectValue placeholder="Select invoice data source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest Available Real Invoice</SelectItem>
                  {realInvoices.map((inv) => (
                    <SelectItem key={inv.id || inv.invoiceNumber} value={String(inv.id || inv.invoiceNumber)}>
                      {inv.invoiceNumber} — {inv.customerName || inv.customer_name || "Customer"} (₹{inv.total || inv.grandTotal || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Live Message Body Preview Box */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Final Generated Message Body</Label>
              <div className="rounded-xl bg-muted/30 border border-border p-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {previewText}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendTestInvoice}
              className="rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white gap-1.5"
            >
              <Send className="size-3.5" /> Send Test Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
