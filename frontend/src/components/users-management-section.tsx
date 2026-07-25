import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Edit2, Ban, CheckCircle, ShieldCheck, Mail, Phone, Store, Lock, UserCheck, Eye, EyeOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { getUsers, createUser, updateUser, disableUser, getStores } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function UsersManagementSection() {
  const currentRole = useApp((s) => s.role);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [storesList, setStoresList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState("Cashier");
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchUsersAndStores = async () => {
    try {
      setLoading(true);
      const [uList, sList] = await Promise.all([getUsers(), getStores()]);
      setUsersList(uList);
      setStoresList(sList);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users or stores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndStores();
  }, []);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormPassword("");
    setFormRole("Cashier");
    setSelectedStoreIds(storesList.length > 0 ? [storesList[0].id] : [1]);
    setModalOpen(true);
  };

  const handleOpenEdit = (u: any) => {
    setEditingUser(u);
    setFormName(u.name || "");
    setFormEmail(u.email || "");
    setFormPhone(u.phone || "");
    setFormPassword(""); // optional on edit
    setFormRole(u.role || "Cashier");
    const currentAssigned = Array.isArray(u.assignedStores)
      ? u.assignedStores.map((s: any) => s.id)
      : [u.store_id || 1];
    setSelectedStoreIds(currentAssigned);
    setModalOpen(true);
  };

  const toggleStoreSelection = (storeId: number) => {
    setSelectedStoreIds((prev) => {
      if (prev.includes(storeId)) {
        if (prev.length <= 1) {
          toast.warning("User must be assigned to at least one store");
          return prev;
        }
        return prev.filter((id) => id !== storeId);
      } else {
        return [...prev, storeId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!editingUser && (!formPassword || formPassword.length < 6)) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: formName,
          email: formEmail,
          phone: formPhone,
          password: formPassword || undefined,
          role: formRole,
          storeIds: selectedStoreIds,
        });
        toast.success(`User "${formName}" updated successfully`);
      } else {
        await createUser({
          name: formName,
          email: formEmail,
          phone: formPhone,
          password: formPassword,
          role: formRole,
          storeIds: selectedStoreIds,
        });
        toast.success(`User "${formName}" created successfully`);
      }
      setModalOpen(false);
      fetchUsersAndStores();
    } catch (err: any) {
      toast.error(err.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisable = async (u: any) => {
    try {
      if (u.status === "disabled") {
        await updateUser(u.id, { status: "active", is_active: 1 });
        toast.success(`User "${u.name}" enabled`);
      } else {
        await disableUser(u.id);
        toast.success(`User "${u.name}" disabled`);
      }
      fetchUsersAndStores();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user status");
    }
  };

  const getRoleBadge = (roleName: string) => {
    const norm = (roleName || "").toLowerCase();
    if (norm === "owner" || norm === "admin") {
      return <Badge variant="default" className="text-[10px] bg-primary">Owner</Badge>;
    }
    if (norm === "manager") {
      return <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Manager</Badge>;
    }
    if (norm === "cashier") {
      return <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Cashier</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">Viewer</Badge>;
  };

  const isManager = currentRole === "Manager";

  return (
    <div className="card-soft p-5 space-y-5">
      <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-base font-bold text-foreground flex items-center gap-2">
            <Users className="size-5 text-primary" /> User Management & Roles
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Manage team access, assign store permissions, and configure role capabilities.
          </div>
        </div>
        <Button onClick={handleOpenCreate} className="rounded-xl h-9 px-4 text-xs font-semibold gap-1.5">
          <Plus className="size-4" /> Add New User
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Loading organization users…</div>
      ) : usersList.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          No users found. Click "Add New User" to invite your team.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usersList.map((u: any) => {
            const isDisabled = u.status === "disabled" || u.is_active === 0;
            const assignedStores: any[] = u.assignedStores || [];

            return (
              <div
                key={u.id}
                className={cn(
                  "p-4 rounded-xl border transition-all space-y-3",
                  isDisabled
                    ? "border-border/40 bg-muted/30 opacity-70"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                      {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{u.name}</span>
                        {getRoleBadge(u.role)}
                      </div>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </div>

                  <div>
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

                <div className="text-xs space-y-1.5 text-muted-foreground pt-1 border-t border-border/40">
                  {u.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3 text-muted-foreground" />
                      <span>{u.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Store className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-medium text-foreground">Assigned Stores:</span>
                    {assignedStores.length === 0 ? (
                      <span className="text-[11px]">Main Store</span>
                    ) : (
                      assignedStores.map((st) => (
                        <Badge key={st.id || st} variant="secondary" className="text-[10px] py-0 px-1.5">
                          {st.name || `Store #${st.id || st}`}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(u)}
                    className="h-7 text-xs rounded-lg px-2.5 gap-1"
                  >
                    <Edit2 className="size-3" /> Edit / Assign Stores
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleDisable(u)}
                    className={cn("h-7 size-7 p-0 rounded-lg", isDisabled ? "text-emerald-600" : "text-destructive")}
                    title={isDisabled ? "Enable User" : "Disable User"}
                  >
                    <Ban className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT USER DIALOG */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingUser ? `Edit User: ${editingUser.name}` : "Create New User Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure user details, role permissions, and store access rights.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="rounded-xl h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email Address *</Label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="rahul@company.com"
                  className="rounded-xl h-9 text-xs"
                  required
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {editingUser ? "New Password (Optional)" : "Password *"}
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? "Leave blank to keep current" : "Min 6 characters"}
                    className="rounded-xl h-9 text-xs pr-9"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned Role *</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger className="rounded-xl h-9 text-xs">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    {!isManager && <SelectItem value="Owner">Owner (Full Org Access)</SelectItem>}
                    <SelectItem value="Manager">Manager (Operations Access)</SelectItem>
                    <SelectItem value="Cashier">Cashier (Billing POS Only)</SelectItem>
                    <SelectItem value="Viewer">Viewer (Read-Only Access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* STORE ASSIGNMENTS */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Store className="size-3.5 text-primary" /> Store Access Assignments
              </Label>
              <div className="text-[11px] text-muted-foreground mb-1.5">
                Select which store outlets this user can access and switch between.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                {storesList.map((st: any) => {
                  const isChecked = selectedStoreIds.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      onClick={() => toggleStoreSelection(st.id)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors",
                        isChecked ? "border-primary/50 bg-primary/5 font-semibold text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by div click
                        className="rounded accent-primary size-3.5"
                      />
                      <span className="truncate">{st.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl h-9 text-xs font-semibold">
                {saving ? "Saving…" : editingUser ? "Update User" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
