import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  WHATSAPP_TEMPLATES_REGISTRY,
  renderWhatsAppTemplate,
  type WhatsAppTemplateConfig,
} from "@/lib/whatsapp-templates";
import { Eye, RotateCcw, Send, CheckCircle, MessageSquare } from "lucide-react";

export function WhatsAppTemplateManager() {
  const [activeTab, setActiveTab] = useState<string>(WHATSAPP_TEMPLATES_REGISTRY[0].id);
  const [templatesState, setTemplatesState] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved templates from localStorage or fallback to defaults
  useEffect(() => {
    const loaded: Record<string, string> = {};
    WHATSAPP_TEMPLATES_REGISTRY.forEach((tpl) => {
      const saved = localStorage.getItem(`orion_wa_template_${tpl.id}`);
      loaded[tpl.id] = saved || tpl.defaultTemplate;
    });
    setTemplatesState(loaded);
  }, []);

  const currentConfig = WHATSAPP_TEMPLATES_REGISTRY.find((t) => t.id === activeTab) || WHATSAPP_TEMPLATES_REGISTRY[0];
  const currentText = templatesState[currentConfig.id] ?? currentConfig.defaultTemplate;

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
      description: "Custom templates are now active across the application.",
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

  const previewText = renderWhatsAppTemplate(currentText, currentConfig.sampleData);

  const handleSendTestMessage = () => {
    const encoded = encodeURIComponent(previewText);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
    toast.success("Opening WhatsApp for test message verification...");
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
            Customize document share templates. Message structure and links remain system controlled.
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

      {/* Editor & Instructions Grid */}
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
              onClick={handleSendTestMessage}
              className="rounded-xl h-8 text-xs border-green-500/30 text-green-600 hover:bg-green-500/10"
            >
              <Send className="size-3 mr-1.5 text-green-500" /> Send Test Message
            </Button>
          </div>
        </div>

        {/* Right 5 cols: Live Preview */}
        <div className="lg:col-span-5 space-y-2 flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div>
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-3">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Eye className="size-4 text-emerald-500" /> Live Message Preview
              </div>
              <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                Updates Real-time
              </Badge>
            </div>

            <div className="rounded-xl bg-background/80 dark:bg-muted/40 border border-emerald-500/20 p-3 text-xs font-mono whitespace-pre-wrap text-foreground leading-relaxed shadow-inner max-h-64 overflow-y-auto">
              {previewText}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground pt-2 border-t border-emerald-500/20 flex items-center gap-1">
            <span>💡</span> Placeholders are automatically populated when sharing documents.
          </div>
        </div>
      </div>
    </div>
  );
}
