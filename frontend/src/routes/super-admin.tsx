import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldAlert, Building2, Store, Users, Search, RefreshCw, Lock, Eye, CheckCircle2, AlertTriangle, Ban, Key, Sparkles, Filter, Plus, Edit, ChevronLeft, ChevronRight
} from "lucide-react";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/format";
import {
  getSuperAdminDashboard,
  getSuperAdminOrganizations,
  getSuperAdminOrganizationDetails,
  updateSuperAdminOrganizationStatus,
  resetSuperAdminOwnerPassword,
  createSuperAdminOrganization,
  editSuperAdminOrganization,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Panel · Apka Bill" },
      { name: "description", content: "Internal SaaS Platform Administration and Customer Tenant Control." },
    ],
  }),
  component: SuperAdminPage,
});

export function SuperAdminPage() {
  const currentRole = useApp((s) => s.role);
  const isSuperAdmin = ["admin", "owner"].includes((currentRole || "").toLowerCase());

  const [metrics, setMetrics] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected Org Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedOrgDetails, setSelectedOrgDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Create Org Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    businessName: "",
    phone: "",
    gstNumber: "",
    address: "",
    ownerName: "",
    email: "",
    password: "",
    storeName: "",
    storeAddress: "",
  });

  // Edit Org Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editOrg, setEditOrg] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    businessName: "",
    phone: "",
    email: "",
    gstNumber: "",
    address: "",
  });

  // Password Reset Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetOrg, setResetOrg] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [m, orgs] = await Promise.all([
        getSuperAdminDashboard(),
        getSuperAdminOrganizations({ q: searchTerm, status: statusFilter }),
      ]);
      setMetrics(m);
      setOrganizations(orgs);
      setCurrentPage(1);
    } catch (err: any) {
      toast.error(err.message || "Failed to load Super Admin panel data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchData();
    }
  }, [searchTerm, statusFilter, isSuperAdmin]);

  const handleOpenDetails = async (orgId: number) => {
    try {
      setLoadingDetails(true);
      setDetailsModalOpen(true);
      const details = await getSuperAdminOrganizationDetails(orgId);
      setSelectedOrgDetails(details);
    } catch (err: any) {
      toast.error(err.message || "Failed to load organization details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStatusChange = async (orgId: number, newStatus: string) => {
    try {
      await updateSuperAdminOrganizationStatus(orgId, newStatus);
      toast.success(`Organization status changed to ${newStatus.toUpperCase()}`);
      fetchData();
      if (selectedOrgDetails && selectedOrgDetails.organization.id === orgId) {
        setSelectedOrgDetails((prev: any) => ({
          ...prev,
          organization: { ...prev.organization, status: newStatus },
        }));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update organization status");
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.businessName.trim()) {
      toast.error("Business Name is required");
      return;
    }
    if (!createForm.ownerName.trim()) {
      toast.error("Owner Name is required");
      return;
    }
    if (!createForm.email.trim()) {
      toast.error("Owner Email is required");
      return;
    }
    if (!createForm.phone.trim()) {
      toast.error("Phone Number is required");
      return;
    }
    if (!createForm.password || createForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setCreateSubmitting(true);
      await createSuperAdminOrganization(createForm);
      toast.success(`New Customer "${createForm.businessName}" created in TRIAL mode!`);
      setCreateModalOpen(false);
      setCreateForm({
        businessName: "",
        phone: "",
        gstNumber: "",
        address: "",
        ownerName: "",
        email: "",
        password: "",
        storeName: "",
        storeAddress: "",
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create customer organization");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenEdit = (org: any) => {
    setEditOrg(org);
    setEditForm({
      businessName: org.name || "",
      phone: org.phone || org.ownerPhone || "",
      email: org.email || org.ownerEmail || "",
      gstNumber: org.gstNumber || "",
      address: org.address || "",
    });
    setEditModalOpen(true);
  };

  const handleEditOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrg) return;

    try {
      setEditSubmitting(true);
      await editSuperAdminOrganization(editOrg.id, editForm);
      toast.success(`Organization "${editForm.businessName}" updated successfully`);
      setEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update organization");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenResetPassword = (org: any) => {
    setResetOrg(org);
    setNewPassword("");
    setConfirmPassword("");
    setResetModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOrg || !newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    try {
      setResetting(true);
      await resetSuperAdminOwnerPassword(resetOrg.id, newPassword);
      toast.success(`Password reset successfully for "${resetOrg.name}" owner`);
      setResetModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  // Pagination Math
  const totalPages = Math.ceil(organizations.length / pageSize) || 1;
  const paginatedOrgs = organizations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!isSuperAdmin) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="text-xl font-bold text-foreground">403 Forbidden</h1>
        <p className="max-w-md text-xs text-muted-foreground">
          Super Admin access is required. Normal customer accounts are not permitted to view this internal panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Super Admin Panel</h1>
            <Badge variant="default" className="bg-primary text-xs">Internal Control</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage all platform tenants, customer organizations, status states, and owner credentials.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button onClick={() => setCreateModalOpen(true)} size="sm" className="rounded-xl text-xs gap-1.5 font-bold">
            <Plus className="size-4" /> Create Organization
          </Button>

          <Button onClick={fetchData} variant="outline" size="sm" className="rounded-xl text-xs gap-1.5">
            <RefreshCw className="size-3.5" /> Refresh Data
          </Button>
        </div>
      </div>

      {/* DASHBOARD METRICS */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
            <span className="text-xs text-muted-foreground">Total Orgs</span>
            <div className="text-xl font-bold text-foreground">{metrics.totalOrganizations}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.activeOrganizations}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-1">
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Trial</span>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{metrics.trialOrganizations}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 space-y-1">
            <span className="text-xs text-destructive font-semibold">Suspended</span>
            <div className="text-xl font-bold text-destructive">{metrics.suspendedOrganizations}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
            <span className="text-xs text-muted-foreground">Total Stores</span>
            <div className="text-xl font-bold text-foreground">{metrics.totalStores}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1">
            <span className="text-xs text-muted-foreground">Total Users</span>
            <div className="text-xl font-bold text-foreground">{metrics.totalUsers}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-1 col-span-2 sm:col-span-1">
            <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Total Sales</span>
            <div className="text-lg font-bold text-foreground">{inr(metrics.totalSales / 100)}</div>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="card-soft p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, phone…"
              className="pl-9 rounded-xl h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
            {["all", "active", "trial", "suspended"].map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(st)}
                className="rounded-xl h-8 text-xs capitalize px-3 shrink-0"
              >
                {st}
              </Button>
            ))}
          </div>
        </div>

        {/* ORGANIZATIONS LIST TABLE */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading customer organizations…</div>
        ) : paginatedOrgs.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No organizations match search filters.
          </div>
        ) : (
          <div className="overflow-x-auto space-y-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Organization</th>
                  <th className="py-2.5 px-3">Owner Details</th>
                  <th className="py-2.5 px-3">Outlets</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paginatedOrgs.map((org) => {
                  const statusNorm = (org.status || "").toLowerCase();

                  return (
                    <tr key={org.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-foreground">{org.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">slug: {org.slug || `org-${org.id}`}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">{org.ownerName}</div>
                        <div className="text-[11px] text-muted-foreground">{org.ownerEmail}</div>
                        {org.ownerPhone && org.ownerPhone !== "N/A" && (
                          <div className="text-[10px] text-muted-foreground">{org.ownerPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {org.storesCount} {org.storesCount === 1 ? "Store" : "Stores"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        {statusNorm === "active" && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold">
                            ACTIVE
                          </Badge>
                        )}
                        {statusNorm === "trial" && (
                          <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10 font-bold">
                            TRIAL
                          </Badge>
                        )}
                        {statusNorm === "suspended" && (
                          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive bg-destructive/10 font-bold">
                            SUSPENDED
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-[11px]">
                        {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetails(org.id)}
                            className="h-7 text-xs rounded-lg px-2 gap-1"
                            title="View Details"
                          >
                            <Eye className="size-3" /> Details
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(org)}
                            className="h-7 text-xs rounded-lg px-2 gap-1 text-primary"
                            title="Edit Organization"
                          >
                            <Edit className="size-3" /> Edit
                          </Button>

                          <Select
                            value={statusNorm.toUpperCase()}
                            onValueChange={(val) => handleStatusChange(org.id, val)}
                          >
                            <SelectTrigger className="h-7 w-28 text-[10px] rounded-lg">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl text-xs">
                              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                              <SelectItem value="TRIAL">TRIAL</SelectItem>
                              <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenResetPassword(org)}
                            className="h-7 text-[10px] rounded-lg px-2 gap-1 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                            title="Reset Owner Password"
                          >
                            <Key className="size-3" /> Reset Pass
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* PAGINATION CONTROLS */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
              <span className="text-muted-foreground">
                Showing {paginatedOrgs.length} of {organizations.length} organizations (Page {currentPage} of {totalPages})
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs rounded-xl px-2.5 gap-1"
                >
                  <ChevronLeft className="size-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs rounded-xl px-2.5 gap-1"
                >
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE NEW ORGANIZATION DIALOG */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="size-5 text-primary" /> Create New Customer Organization
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Super Admin onboarding creation. Organization, Store, and Owner account are created atomically in TRIAL status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOrganization} className="space-y-4 py-2">
            <div className="space-y-2 border-b border-border/50 pb-3">
              <div className="text-xs font-bold text-foreground">1. Business Profile</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Business Name *</Label>
                  <Input
                    value={createForm.businessName}
                    onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })}
                    placeholder="e.g. Metro Mart Retail"
                    className="rounded-xl h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Business Phone *</Label>
                  <Input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="rounded-xl h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GSTIN (Optional)</Label>
                  <Input
                    value={createForm.gstNumber}
                    onChange={(e) => setCreateForm({ ...createForm, gstNumber: e.target.value })}
                    placeholder="27ABCDE1234F1Z5"
                    className="rounded-xl h-9 text-xs font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Business Address</Label>
                  <Input
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    placeholder="Address"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 border-b border-border/50 pb-3">
              <div className="text-xs font-bold text-foreground">2. Owner Credentials</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Owner Full Name *</Label>
                  <Input
                    value={createForm.ownerName}
                    onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                    placeholder="e.g. Rajesh Patel"
                    className="rounded-xl h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Owner Email *</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="owner@metromart.com"
                    className="rounded-xl h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Initial Password *</Label>
                  <Input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                    className="rounded-xl h-9 text-xs"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-foreground">3. Store Outlet (Optional)</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Store Name</Label>
                  <Input
                    value={createForm.storeName}
                    onChange={(e) => setCreateForm({ ...createForm, storeName: e.target.value })}
                    placeholder="Defaults to Main Store"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Store Address</Label>
                  <Input
                    value={createForm.storeAddress}
                    onChange={(e) => setCreateForm({ ...createForm, storeAddress: e.target.value })}
                    placeholder="Store Address"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)} className="rounded-xl h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={createSubmitting} className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground">
                {createSubmitting ? "Creating Customer…" : "Save & Create Organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT ORGANIZATION DIALOG */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit Organization Details</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update organization identity and contact profile.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditOrganization} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Business Name *</Label>
              <Input
                value={editForm.businessName}
                onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                className="rounded-xl h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">GSTIN Number</Label>
              <Input
                value={editForm.gstNumber}
                onChange={(e) => setEditForm({ ...editForm, gstNumber: e.target.value })}
                className="rounded-xl h-9 text-xs font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="rounded-xl h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)} className="rounded-xl h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={editSubmitting} className="rounded-xl h-9 text-xs font-bold">
                {editSubmitting ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ORGANIZATION DETAILS DIALOG */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              {selectedOrgDetails?.organization?.name || "Organization Overview"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Internal view of tenant organization properties, owner info, and store outlets.
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading details…</div>
          ) : selectedOrgDetails ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-xl border border-border/50">
                <div>
                  <span className="text-muted-foreground">Organization ID:</span>
                  <div className="font-bold">#{selectedOrgDetails.organization.id}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Slug:</span>
                  <div className="font-bold font-mono">{selectedOrgDetails.organization.slug}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {selectedOrgDetails.organization.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Billing Plan:</span>
                  <div className="font-bold">{selectedOrgDetails.organization.billing_plan || "Basic"}</div>
                </div>
              </div>

              {/* OWNER INFO */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-foreground">Owner Account</div>
                {selectedOrgDetails.owner ? (
                  <div className="p-3 rounded-xl border border-border bg-card text-xs space-y-1">
                    <div className="font-bold text-foreground">{selectedOrgDetails.owner.name}</div>
                    <div className="text-muted-foreground">{selectedOrgDetails.owner.email}</div>
                    {selectedOrgDetails.owner.phone && (
                      <div className="text-muted-foreground">{selectedOrgDetails.owner.phone}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No owner registered yet.</div>
                )}
              </div>

              {/* STORES LIST */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-foreground">Store Outlets ({selectedOrgDetails.stores?.length || 0})</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedOrgDetails.stores?.map((st: any) => (
                    <div key={st.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-card text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{st.name}</span>
                        <span className="text-muted-foreground text-[10px] ml-2">Code: {st.code || `#${st.id}`}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {st.status || "active"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsModalOpen(false)} className="rounded-xl h-9 text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESET OWNER PASSWORD DIALOG */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Reset Owner Password</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set a new login password for the owner of "{resetOrg?.name}".
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">New Password *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="rounded-xl h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirm Password *</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="rounded-xl h-9 text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setResetModalOpen(false)} className="rounded-xl h-9 text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={resetting} className="rounded-xl h-9 text-xs font-semibold bg-amber-600 hover:bg-amber-700">
                {resetting ? "Resetting…" : "Set New Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
