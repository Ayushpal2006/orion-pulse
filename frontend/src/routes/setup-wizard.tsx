import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Store, FileText, Upload, CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Receipt, ShoppingBag, LayoutDashboard, Plus, HelpCircle
} from "lucide-react";
import { completeOnboardingApi, getOrganizationCurrent, createProduct } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/setup-wizard")({
  head: () => ({
    meta: [
      { title: "First-Time Setup Wizard · Apka Bill" },
      { name: "description", content: "Configure your retail shop in less than 5 minutes." },
    ],
  }),
  component: SetupWizardPage,
});

function SetupWizardPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // STEP 1: Business Information
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");

  // STEP 2: Store Information
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");

  // STEP 3: Receipt Configuration
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [receiptInfo, setReceiptInfo] = useState("Thank you for shopping with us! Visit again.");
  const [printBusinessName, setPrintBusinessName] = useState(true);
  const [printGst, setPrintGst] = useState(true);
  const [printPhone, setPrintPhone] = useState(true);

  // STEP 4: Initial Product Import
  const [importOption, setImportOption] = useState<"empty" | "excel">("empty");
  const [sampleProductName, setSampleProductName] = useState("");
  const [sampleProductPrice, setSampleProductPrice] = useState("");
  const [sampleProductCost, setSampleProductCost] = useState("");

  useEffect(() => {
    // Pre-fill existing organization data if available
    getOrganizationCurrent()
      .then((data) => {
        if (data) {
          if (data.name) {
            setBusinessName(data.name);
            setStoreName(`${data.name} Main Store`);
          }
          if (data.phone) {
            setPhone(data.phone);
            setStorePhone(data.phone);
          }
          if (data.email) setEmail(data.email);
          if (data.gst_number) setGstNumber(data.gst_number);
          if (data.address) {
            setAddress(data.address);
            setStoreAddress(data.address);
          }
          if (data.invoice_prefix) setInvoicePrefix(data.invoice_prefix);
          if (data.receipt_info) setReceiptInfo(data.receipt_info);
        }
      })
      .catch(() => {});
  }, []);

  const handleNextStep1 = () => {
    if (!businessName.trim()) {
      toast.error("Business Name is required");
      return;
    }
    if (!ownerName.trim()) {
      toast.error("Owner Name is required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Mobile / Contact Number is required");
      return;
    }

    if (!storeName.trim()) {
      setStoreName(`${businessName.trim()} Main Store`);
    }
    if (!storeAddress.trim()) {
      setStoreAddress(address);
    }
    if (!storePhone.trim()) {
      setStorePhone(phone);
    }

    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    if (!storeName.trim()) {
      toast.error("Store Name is required");
      return;
    }
    setCurrentStep(3);
  };

  const handleNextStep3 = () => {
    setCurrentStep(4);
  };

  const handleNextStep4 = async () => {
    try {
      setSaving(true);
      // If user provided a sample product to add, create it now
      if (importOption === "excel" && sampleProductName.trim() && sampleProductPrice) {
        try {
          await createProduct({
            name: sampleProductName.trim(),
            price: Math.round(parseFloat(sampleProductPrice) * 100),
            cost_price: sampleProductCost ? Math.round(parseFloat(sampleProductCost) * 100) : 0,
            stock: 10,
            sku: `SKU-${Date.now().toString().slice(-4)}`,
            category: "General",
          });
        } catch (e) {
          // ignore product creation error
        }
      }

      // Complete onboarding in backend
      await completeOnboardingApi({
        businessName,
        ownerName,
        phone,
        email,
        gstNumber,
        address,
        storeName,
        storeAddress,
        storePhone,
        invoicePrefix,
        receiptInfo,
        printBusinessName,
        printGst,
        printPhone,
      });

      setCurrentStep(5);
      toast.success("Shop onboarding configured successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save setup configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = (targetRoute: string) => {
    navigate({ to: targetRoute as any });
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* WIZARD HEADER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="size-3.5" /> 5-Minute Express Setup
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Configure Your Retail Shop</h1>
          <p className="text-xs text-muted-foreground">Follow these simple steps to start billing customers in Apka Bill.</p>
        </div>

        {/* STEP PROGRESS INDICATOR */}
        <div className="grid grid-cols-5 gap-2 border-b border-border/60 pb-4">
          {[
            { step: 1, label: "Business" },
            { step: 2, label: "Store" },
            { step: 3, label: "Receipt" },
            { step: 4, label: "Products" },
            { step: 5, label: "Ready!" },
          ].map((item) => {
            const isDone = currentStep > item.step;
            const isCurrent = currentStep === item.step;

            return (
              <div key={item.step} className="flex flex-col items-center gap-1.5 text-center">
                <div
                  className={cn(
                    "grid size-8 place-items-center rounded-full font-bold text-xs transition-all",
                    isDone ? "bg-emerald-500 text-white" : isCurrent ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? <CheckCircle2 className="size-4" /> : item.step}
                </div>
                <span className={cn("text-[11px] font-medium hidden sm:block", isCurrent ? "text-primary font-bold" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* STEP CONTENT CARD */}
        <div className="card-soft p-6 border border-border bg-card rounded-2xl shadow-sm space-y-6">
          {/* STEP 1: BUSINESS INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-2">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="size-5 text-primary" /> Step 1: Business Profile Information
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Enter your business identity and primary owner contact details.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Business / Shop Name *</Label>
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Apka Bill Enterprise Store"
                    className="rounded-xl h-10 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Owner / Manager Full Name *</Label>
                  <Input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="rounded-xl h-10 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Mobile / Contact Number *</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="rounded-xl h-10 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Business Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@business.com"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">GSTIN / Tax Number (Optional)</Label>
                  <Input
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="27ABCDE1234F1Z5"
                    className="rounded-xl h-10 text-xs font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Business Registered Address</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop 12, Main Market, MG Road, Pune"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleNextStep1} className="rounded-xl h-10 px-5 text-xs font-bold gap-2">
                  Continue to Store Setup <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: STORE INFORMATION */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-2">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Store className="size-5 text-primary" /> Step 2: Primary Store Outlet Setup
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure your primary physical store location.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold">Store Outlet Name *</Label>
                  <Input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Main Market Outlet"
                    className="rounded-xl h-10 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Store Phone Number</Label>
                  <Input
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    placeholder={phone || "+91 98765 43210"}
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Store Outlet Address</Label>
                  <Input
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder={address || "Store Address"}
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="rounded-xl h-10 text-xs gap-1.5">
                  <ArrowLeft className="size-4" /> Back
                </Button>
                <Button onClick={handleNextStep2} className="rounded-xl h-10 px-5 text-xs font-bold gap-2">
                  Continue to Receipt Settings <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: RECEIPT CONFIGURATION & PREVIEW */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-2">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Receipt className="size-5 text-primary" /> Step 3: Receipt & Thermal Print Setup
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Customize headers, footers, and live thermal receipt output.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Invoice Sequence Prefix</Label>
                    <Input
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      placeholder="INV-"
                      className="rounded-xl h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Receipt Footer Message</Label>
                    <Textarea
                      value={receiptInfo}
                      onChange={(e) => setReceiptInfo(e.target.value)}
                      placeholder="e.g. Thank you for shopping! Goods once sold cannot be returned."
                      className="rounded-xl text-xs min-h-[70px]"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Label className="text-xs font-semibold">Receipt Printing Preferences</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printBusinessName}
                          onChange={(e) => setPrintBusinessName(e.target.checked)}
                          className="rounded accent-primary size-3.5"
                        />
                        <span>Print Business Name on Header</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printGst}
                          onChange={(e) => setPrintGst(e.target.checked)}
                          className="rounded accent-primary size-3.5"
                        />
                        <span>Print GSTIN on Receipts</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={printPhone}
                          onChange={(e) => setPrintPhone(e.target.checked)}
                          className="rounded accent-primary size-3.5"
                        />
                        <span>Print Store Contact Number</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* LIVE RECEIPT PREVIEW */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <FileText className="size-3.5 text-primary" /> Live Thermal Receipt Preview
                  </Label>
                  <div className="p-4 rounded-xl border border-dashed border-border bg-white text-black font-mono text-[11px] space-y-2 shadow-inner">
                    <div className="text-center border-b border-dashed border-black/30 pb-2 space-y-0.5">
                      {printBusinessName && <div className="font-bold text-sm">{businessName || "BUSINESS NAME"}</div>}
                      <div className="text-[10px]">{storeName || "MAIN STORE"}</div>
                      {printPhone && phone && <div className="text-[10px]">Ph: {phone}</div>}
                      {printGst && gstNumber && <div className="text-[10px]">GSTIN: {gstNumber}</div>}
                    </div>

                    <div className="flex justify-between text-[10px]">
                      <span>Inv: {invoicePrefix}001</span>
                      <span>Date: {new Date().toLocaleDateString()}</span>
                    </div>

                    <div className="border-t border-b border-dashed border-black/30 py-1 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>ITEM</span>
                        <span>QTY x PRICE</span>
                        <span>AMT</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sample Retail Item</span>
                        <span>1 x ₹150</span>
                        <span>₹150</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-bold text-xs pt-1">
                      <span>TOTAL PAID</span>
                      <span>₹150.00</span>
                    </div>

                    <div className="text-center text-[10px] pt-2 border-t border-dashed border-black/30">
                      {receiptInfo || "Thank you for your visit!"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="rounded-xl h-10 text-xs gap-1.5">
                  <ArrowLeft className="size-4" /> Back
                </Button>
                <Button onClick={handleNextStep3} className="rounded-xl h-10 px-5 text-xs font-bold gap-2">
                  Continue to Product Import <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: INITIAL PRODUCT IMPORT */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-2">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Upload className="size-5 text-primary" /> Step 4: Catalog & Product Setup
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Start with fresh inventory or quickly add sample products.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setImportOption("empty")}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all space-y-2",
                    importOption === "empty" ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Start with Blank Catalog</span>
                    <Badge variant={importOption === "empty" ? "default" : "outline"} className="text-[10px]">
                      Option 1
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create products manually during billing or import later from Products management.
                  </p>
                </div>

                <div
                  onClick={() => setImportOption("excel")}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all space-y-2",
                    importOption === "excel" ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Add First Sample Item</span>
                    <Badge variant={importOption === "excel" ? "default" : "outline"} className="text-[10px]">
                      Option 2
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quickly add a sample item right now so your POS billing engine is ready.
                  </p>
                </div>
              </div>

              {importOption === "excel" && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 pt-3">
                  <Label className="text-xs font-semibold">Sample First Product Details</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      value={sampleProductName}
                      onChange={(e) => setSampleProductName(e.target.value)}
                      placeholder="Product Name (e.g. Rice Bag 5kg)"
                      className="rounded-xl h-9 text-xs"
                    />
                    <Input
                      type="number"
                      value={sampleProductPrice}
                      onChange={(e) => setSampleProductPrice(e.target.value)}
                      placeholder="Selling Price (₹)"
                      className="rounded-xl h-9 text-xs"
                    />
                    <Input
                      type="number"
                      value={sampleProductCost}
                      onChange={(e) => setSampleProductCost(e.target.value)}
                      placeholder="Cost Price (₹)"
                      className="rounded-xl h-9 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(3)} className="rounded-xl h-10 text-xs gap-1.5">
                  <ArrowLeft className="size-4" /> Back
                </Button>
                <Button onClick={handleNextStep4} disabled={saving} className="rounded-xl h-10 px-5 text-xs font-bold gap-2">
                  {saving ? "Configuring Shop…" : "Complete Shop Setup"} <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS SCREEN */}
          {currentStep === 5 && (
            <div className="py-8 text-center space-y-6">
              <div className="inline-flex items-center justify-center size-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-10" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Congratulations! 🎉</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Your shop <strong className="text-foreground">{businessName}</strong> is fully configured and ready for POS operations.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Button
                  onClick={() => handleFinish("/billing")}
                  className="w-full sm:w-auto rounded-xl h-11 px-6 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ShoppingCart className="size-4" /> Go to Billing POS
                </Button>

                <Button
                  onClick={() => handleFinish("/")}
                  variant="outline"
                  className="w-full sm:w-auto rounded-xl h-11 px-6 text-xs font-bold gap-2"
                >
                  <LayoutDashboard className="size-4" /> Go to Dashboard
                </Button>

                <Button
                  onClick={() => handleFinish("/products")}
                  variant="secondary"
                  className="w-full sm:w-auto rounded-xl h-11 px-6 text-xs font-bold gap-2"
                >
                  <Plus className="size-4" /> Add Products
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
