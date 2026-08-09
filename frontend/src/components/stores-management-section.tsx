import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Edit2, Ban, CheckCircle, Store, ShieldCheck, MapPin, Phone, FileText } from "lucide-react";
import { useApp } from "@/lib/store";
import { getStores, createStore, updateStore, disableStore, switchStore } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function StoresManagementSection() {
  const activeStoreId = useApp((s) => s.activeStoreId);
  const setActiveStoreId = useApp((s) => s.setActiveStoreId);
  const setActiveStoreName = useApp((s) => s.setActiveStoreName);
  const storesList = useApp((s) => s.storesList);
  const setStoresList = useApp((s) => s.setStoresList);

  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formGstNumber, setFormGstNumber] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formCountry, setFormCountry] = useState("India");
  const [formCurrency, setFormCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);

  const s = useApp();
  const fetchStores = async () => {
    try {
      setLoading(true);
      const data = await getStores();
      setStoresList(data);
      if (Array.isArray(data) && data.length > 0) {
        const activeSt = data.find((st: any) => st.id === activeStoreId) || data[0];
        if (activeSt) {
          if (activeSt.name) s.setShopName(activeSt.name);
          if (activeSt.gst_number) s.setGstin(activeSt.gst_number);
          if (activeSt.phone) s.setStorePhone(activeSt.phone);
          if (activeSt.address) s.setStoreAddress(activeSt.address);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load stores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleOpenCreate = () => {
    setEditingStore(null);
    setFormName("");
    setFormCode(`STR-${Math.floor(100 + Math.random() * 900)}`);
    setFormPhone("");
    setFormGstNumber("");
    setFormAddress("");
    setFormCity("");
    setFormState("");
    setFormCountry("India");
    setFormCurrency("INR");
    setModalOpen(true);
  };

  const handleOpenEdit = (store: any) => {
    setEditingStore(store);
    setFormName(store.name || "");
    setFormCode(store.code || "");
    setFormPhone(store.phone || "");
    setFormGstNumber(store.gst_number || "");
    setFormAddress(store.address || "");
    setFormCity(store.city || "");
    setFormState(store.state || "");
    setFormCountry(store.country || "India");
    setFormCurrency(store.currency || "INR");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Store name is required");
      return;
    }

    try {
      setSaving(true);
      if (editingStore) {
        await updateStore(editingStore.id, {
          name: formName,
          code: formCode,
          phone: formPhone,
          gstNumber: formGstNumber,
          address: formAddress,
          city: formCity,
          state: formState,
          country: formCountry,
          currency: formCurrency,
        });
        toast.success(`Store "${formName}" updated successfully`);
      } else {
        await createStore({
          name: formName,
          code: formCode,
          phone: formPhone,
          gstNumber: formGstNumber,
          address: formAddress,
          city: formCity,
          state: formState,
          country: formCountry,
          currency: formCurrency,
        });
        toast.success(`Store "${formName}" created successfully`);
      }
      setModalOpen(false);
      fetchStores();
    } catch (err: any) {
      toast.error(err.message || "Failed to save store");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisable = async (store: any) => {
    try {
      if (store.status === "disabled") {
        await updateStore(store.id, { status: "active" });
        toast.success(`Store "${store.name}" enabled`);
      } else {
        await disableStore(store.id);
        toast.success(`Store "${store.name}" disabled`);
      }
      fetchStores();
    } catch (err: any) {
      toast.error(err.message || "Failed to update store status");
    }
  };

  const handleSelectStore = async (store: any) => {
    if (store.id === activeStoreId) return;
    try {
      await switchStore(store.id);
      setActiveStoreId(store.id);
      setActiveStoreName(store.name);
      toast.success(`Switched active store to "${store.name}"`);
    } catch (err: any) {
      toast.error(err.message || "Failed to switch store");
    }
  };

  return (
    <div className="card-soft p-5 space-y-5">
      <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-base font-bold text-foreground flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> Store Management
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Manage multi-store locations, outlets, and active store context.
          </div>
        </div>
        <Button onClick={handleOpenCreate} className="rounded-xl h-9 px-4 text-xs font-semibold gap-1.5">
          <Plus className="size-4" /> Add New Store
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Loading stores…</div>
      ) : storesList.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          No stores found. Click "Add New Store" to create your first store.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {storesList.map((st: any) => {
            const isActiveContext = st.id === activeStoreId;
            const isDisabled = st.status === "disabled";

            return (
              <div
                key={st.id}
                className={cn(
                  "p-4 rounded-xl border transition-all space-y-3",
                  isActiveContext
                    ? "border-primary/50 bg-primary/5 shadow-sm"
                    : isDisabled
                    ? "border-border/40 bg-muted/30 opacity-70"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "grid size-9 place-items-center rounded-lg text-primary font-bold text-sm",
                      isActiveContext ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}>
                      <Store className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{st.name}</span>
                        {st.is_default === 1 && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Default</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {st.code || `ID: #${st.id}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isDisabled ? (
                      <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                        Disabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/40">
                  {st.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3 text-muted-foreground" />
                      <span>{st.phone}</span>
                    </div>
                  )}
                  {st.gst_number && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <FileText className="size-3 text-muted-foreground" />
                      <span>GST: {st.gst_number}</span>
                    </div>
                  )}
                  {(st.address || st.city || st.state) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {[st.address, st.city, st.state, st.country].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  {isActiveContext ? (
                    <Badge variant="default" className="text-xs gap-1 py-1 px-2 bg-primary">
                      <CheckCircle className="size-3" /> Selected Store
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDisabled}
                      onClick={() => handleSelectStore(st)}
                      className="h-7 text-xs rounded-lg px-2.5"
                    >
                      Switch to Store
                    </Button>
                  )}

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(st)}
                      className="h-7 size-7 p-0 rounded-lg"
                      title="Edit Store"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleDisable(st)}
                      className={cn("h-7 size-7 p-0 rounded-lg", isDisabled ? "text-emerald-600" : "text-destructive")}
                      title={isDisabled ? "Enable Store" : "Disable Store"}
                    >
                      <Ban className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT STORE DIALOG */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingStore ? "Edit Store Details" : "Add New Store Location"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingStore
                ? `Update operational settings for ${editingStore.name}`
                : "Create a new store outlet or branch for your organization."}
              <br />
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Note: Printed business branding (Logo, GSTIN, Address, Phone) is managed centrally in Settings ➔ Branding.
              </span>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Store Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Main Market Outlet"
                className="rounded-xl h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Store Code</Label>
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. STR-001"
                  className="rounded-xl h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">GSTIN / Tax Number</Label>
              <Input
                value={formGstNumber}
                onChange={(e) => setFormGstNumber(e.target.value)}
                placeholder="27ABCDE1234F1Z5"
                className="rounded-xl h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Street Address</Label>
              <Input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Shop 12, Commercial Complex"
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">City</Label>
                <Input
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="Pune"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">State</Label>
                <Input
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  placeholder="Maharashtra"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Country</Label>
                <Input
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value)}
                  placeholder="India"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl h-9 text-xs font-semibold">
                {saving ? "Saving…" : editingStore ? "Update Store" : "Create Store"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
