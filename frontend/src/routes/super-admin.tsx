import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldAlert, Building2, Store, Users, Search, RefreshCw, Lock, Eye, CheckCircle2, AlertTriangle, Ban, Key, Sparkles, Filter, Plus, Edit, ChevronLeft, ChevronRight, Activity, CreditCard, FileText, Server, Settings, User, LogOut, CheckCircle, ShieldCheck, Database, HardDrive, Globe, Trash2, Copy, Check, Bell, Moon, Sun, Layers, DollarSign, Terminal, Shield, Zap
} from "lucide-react";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/format";
import {
  getSuperAdminDashboard,
  getSuperAdminOrganizations,
  getSuperAdminOrganizationDetails,
  updateSuperAdminOrganizationStatus,
  updateSuperAdminSubscription,
  resetSuperAdminOwnerPassword,
  createSuperAdminOrganization,
  editSuperAdminOrganization,
  deleteSuperAdminOrganization,
  getSuperAdminStores,
  getSuperAdminUsers,
  updateSuperAdminUserStatus,
  resetSuperAdminUserPassword,
  getSuperAdminAuditLogs,
  getSuperAdminSystemHealth,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Portal · Apka Bill SaaS" },
      { name: "description", content: "Executive SaaS Administration & Multi-Tenant Control." },
    ],
  }),
  component: SuperAdminPage,
});

export function SuperAdminPage() {
  const currentRole = useApp((s) => s.role);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "organizations" | "stores" | "users" | "subscriptions" | "plans" | "payments" | "audit-logs" | "system-health" | "settings" | "profile"
  >("dashboard");

  const [metrics, setMetrics] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [storesList, setStoresList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Theme mode toggle
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  // Password Management & Reset Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passOrg, setPassOrg] = useState<any>(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copiedPass, setCopiedPass] = useState(false);
  const [confirmPassModal, setConfirmPassModal] = useState(false);
  const [resettingPass, setResettingPass] = useState(false);

  // Subscription Plan Change Modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planOrg, setPlanOrg] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState("Basic");
  const [updatingPlan, setUpdatingPlan] = useState(false);

  // Soft Delete Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [m, orgs, stores, users, logs, health] = await Promise.all([
        getSuperAdminDashboard(),
        getSuperAdminOrganizations({ q: searchTerm, status: statusFilter }),
        getSuperAdminStores().catch(() => []),
        getSuperAdminUsers().catch(() => []),
        getSuperAdminAuditLogs().catch(() => []),
        getSuperAdminSystemHealth().catch(() => null),
      ]);
      setMetrics(m);
      setOrganizations(orgs);
      setStoresList(stores);
      setUsersList(users);
      setAuditLogs(logs);
      setSystemHealth(health);
      setCurrentPage(1);
    } catch (err: any) {
      toast.error(err.message || "Failed to load Super Admin portal data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchTerm, statusFilter]);

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
    } catch (err: any) {
      toast.error(err.message || "Failed to update organization status");
    }
  };

  const handleGenerateStrongPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let pass = "Apka#";
    for (let i = 0; i < 7; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(pass);
    setCopiedPass(false);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopiedPass(true);
    toast.success("Generated password copied to clipboard!");
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleConfirmResetPassword = async () => {
    if (!passOrg || !generatedPassword) return;
    try {
      setResettingPass(true);
      await resetSuperAdminOwnerPassword(passOrg.id, generatedPassword);
      toast.success(`Password updated successfully for ${passOrg.name} Owner!`);
      setPasswordModalOpen(false);
      setConfirmPassModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setResettingPass(false);
    }
  };

  const handleSavePlanChange = async () => {
    if (!planOrg) return;
    try {
      setUpdatingPlan(true);
      await updateSuperAdminSubscription(planOrg.id, selectedPlan);
      toast.success(`Plan updated to ${selectedPlan} for ${planOrg.name}`);
      setPlanModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update subscription plan");
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleSoftDeleteOrg = async () => {
    if (!deleteOrgTarget) return;
    try {
      await deleteSuperAdminOrganization(deleteOrgTarget.id);
      toast.success(`Organization ${deleteOrgTarget.name} soft-deleted`);
      setDeleteModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete organization");
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.businessName.trim()) return toast.error("Business Name is required");
    if (!createForm.ownerName.trim()) return toast.error("Owner Name is required");
    if (!createForm.email.trim()) return toast.error("Owner Email is required");
    if (!createForm.password || createForm.password.length < 6) return toast.error("Password min 6 chars");

    try {
      setCreateSubmitting(true);
      await createSuperAdminOrganization(createForm);
      toast.success("Organization & Owner Account created successfully in TRIAL status!");
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
      toast.error(err.message || "Failed to create organization");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    toast.success("Logged out from Super Admin Portal");
    window.location.href = "/login";
  };

  const totalPages = Math.ceil(organizations.length / pageSize) || 1;
  const paginatedOrgs = organizations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusBadge = (st: string) => {
    const s = (st || "active").toLowerCase();
    if (s === "active") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Active</Badge>;
    if (s === "trial") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Trial</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Suspended</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const p = (plan || "Basic").toLowerCase();
    if (p === "enterprise") return <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">Enterprise</Badge>;
    if (p === "pro" || p === "professional") return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Pro</Badge>;
    return <Badge variant="secondary">Basic</Badge>;
  };

  return (
    <div className={cn("min-h-screen flex flex-col md:flex-row font-sans bg-background text-foreground", isDarkMode ? "dark" : "")}>
      {/* LEFT SIDEBAR */}
      <aside className="w-full md:w-64 border-r border-border bg-card/80 backdrop-blur shrink-0 flex flex-col justify-between p-4 space-y-6">
        <div className="space-y-6">
          {/* BRAND HEADER */}
          <div className="flex items-center gap-3 px-2">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shadow-sm">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground tracking-tight flex items-center gap-1">
                Apka Bill <Sparkles className="size-3 text-amber-500" />
              </h2>
              <p className="text-[10px] text-muted-foreground font-mono">SAAS OWNER PORTAL</p>
            </div>
          </div>

          {/* NAV LINKS */}
          <nav className="space-y-1 text-xs">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left",
                activeTab === "dashboard" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Activity className="size-4" /> Dashboard
            </button>

            <button
              onClick={() => setActiveTab("organizations")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left justify-between",
                activeTab === "organizations" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="size-4" /> Organizations
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{organizations.length}</Badge>
            </button>

            <button
              onClick={() => setActiveTab("stores")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left",
                activeTab === "stores" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Store className="size-4" /> Stores ({storesList.length})
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left",
                activeTab === "users" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Users className="size-4" /> Users ({usersList.length})
            </button>

            <button
              onClick={() => setActiveTab("subscriptions")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left",
                activeTab === "subscriptions" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <CreditCard className="size-4" /> Subscriptions & Plans
            </button>

            <button
              onClick={() => setActiveTab("payments")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left",
                activeTab === "payments" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <DollarSign className="size-4" /> Payments Log
            </button>

            <button
              onClick={() => setActiveTab("audit-logs")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left",
                activeTab === "audit-logs" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <FileText className="size-4" /> Audit Logs
            </button>

            <button
              onClick={() => setActiveTab("system-health")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left",
                activeTab === "system-health" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Server className="size-4" /> System Telemetry
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-colors text-left",
                activeTab === "settings" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Settings className="size-4" /> Platform Settings
            </button>
          </nav>
        </div>

        {/* FOOTER USER / LOGOUT */}
        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Super Admin</p>
              <p className="text-[10px] text-muted-foreground truncate">superadmin@orion.com</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-8 gap-2 rounded-xl"
          >
            <LogOut className="size-3.5" /> Logout
          </Button>
        </div>
      </aside>

      {/* RIGHT MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR */}
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Global Search (Orgs, Users, Stores)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-border bg-background"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>

            <Button variant="ghost" size="icon" className="size-8 rounded-xl text-muted-foreground hover:text-foreground relative">
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-emerald-500 animate-pulse" />
            </Button>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] font-mono">
                LIVE
              </Badge>
            </div>
          </div>
        </header>

        {/* MAIN BODY AREA */}
        <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
          {/* DASHBOARD TAB */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">SaaS Executive Dashboard</h1>
                  <p className="text-xs text-muted-foreground">Real-time overview across all tenant organizations and system infrastructure</p>
                </div>
                <Button size="sm" variant="outline" onClick={fetchData} className="rounded-xl h-9 text-xs gap-1.5">
                  <RefreshCw className="size-3.5" /> Refresh Telemetry
                </Button>
              </div>

              {/* KPI METRICS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Total Organizations</span>
                    <Building2 className="size-4 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{metrics?.totalOrganizations ?? 0}</div>
                  <div className="text-[11px] text-emerald-600 font-medium">{metrics?.activeOrganizations ?? 0} Active Customers</div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Total Retail Stores</span>
                    <Store className="size-4 text-blue-500" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{metrics?.totalStores ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground font-medium">Active POS Outlets</div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Platform Users</span>
                    <Users className="size-4 text-amber-500" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{metrics?.totalUsers ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground font-medium">Tenant Accounts</div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span>Platform Gross Sales</span>
                    <DollarSign className="size-4 text-emerald-500" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{inr(metrics?.totalSales ?? 0)}</div>
                  <div className="text-[11px] text-emerald-600 font-medium">Processed Billing Sum</div>
                </div>
              </div>

              {/* SUBSCRIPTION DISTRIBUTION & TELEMETRY */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="size-4 text-primary" /> Active SaaS Tenant Subscriptions
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-200">
                      <div className="text-2xl font-bold text-emerald-600">{metrics?.activeOrganizations ?? 0}</div>
                      <div className="text-xs text-emerald-700">Active Paid Plans</div>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-200">
                      <div className="text-2xl font-bold text-amber-600">{metrics?.trialOrganizations ?? 0}</div>
                      <div className="text-xs text-amber-700">Free Trial Accounts</div>
                    </div>
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                      <div className="text-2xl font-bold text-destructive">{metrics?.suspendedOrganizations ?? 0}</div>
                      <div className="text-xs text-destructive">Suspended Orgs</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Server className="size-4 text-emerald-500" /> System Telemetry & Status
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 font-medium">
                      <span className="flex items-center gap-2"><Database className="size-3.5" /> Railway PostgreSQL</span>
                      <span>99.99% ONLINE</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 text-blue-700 font-medium">
                      <span className="flex items-center gap-2"><Globe className="size-3.5" /> Express API Gateway</span>
                      <span>200 OK</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/10 text-purple-700 font-medium">
                      <span className="flex items-center gap-2"><HardDrive className="size-3.5" /> Cloudinary Media CDN</span>
                      <span>CONNECTED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ORGANIZATIONS TAB */}
          {(activeTab === "dashboard" || activeTab === "organizations") && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">SaaS Organizations ({organizations.length})</h2>
                  <p className="text-xs text-muted-foreground">Manage multi-tenant business accounts, owner passwords, and plans</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setCreateModalOpen(true)} className="rounded-xl h-9 text-xs gap-1.5 shadow-sm font-semibold">
                    <Plus className="size-4" /> Create Organization
                  </Button>
                </div>
              </div>

              {/* SEARCH & FILTERS */}
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-2xl border border-border">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search organization by business name, owner email, or phone…"
                    className="pl-9 h-9 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-9 rounded-xl text-xs">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl text-xs">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="sm" onClick={fetchData} className="rounded-xl h-9 text-xs">
                    <RefreshCw className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* ORGANIZATIONS TABLE */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5">Organization</th>
                        <th className="p-3.5">Owner Details</th>
                        <th className="p-3.5">Plan</th>
                        <th className="p-3.5">Stores</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Created</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" /> Loading Organizations…
                          </td>
                        </tr>
                      ) : paginatedOrgs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            No organizations found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        paginatedOrgs.map((org) => (
                          <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-3">
                                <div className="size-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shadow-sm">
                                  {org.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground">{org.name}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">#{org.id} · {org.slug}</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div className="font-medium text-foreground">{org.ownerName}</div>
                              <div className="text-[10px] text-muted-foreground">{org.ownerEmail}</div>
                            </td>

                            <td className="p-3.5">{getPlanBadge(org.billingPlan)}</td>
                            <td className="p-3.5 font-medium">{org.storesCount} Stores</td>
                            <td className="p-3.5">{getStatusBadge(org.status)}</td>
                            <td className="p-3.5 text-muted-foreground">
                              {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "N/A"}
                            </td>

                            <td className="p-3.5 text-right space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenDetails(org.id)}
                                className="h-8 rounded-lg text-xs gap-1"
                                title="View full organization 360 overview"
                              >
                                <Eye className="size-3.5" /> View
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setPassOrg(org);
                                  handleGenerateStrongPassword();
                                  setPasswordModalOpen(true);
                                }}
                                className="h-8 rounded-lg text-xs gap-1 text-purple-600 hover:bg-purple-50"
                                title="Password Management"
                              >
                                <Key className="size-3.5" /> Password
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setPlanOrg(org);
                                  setSelectedPlan(org.billingPlan || "Basic");
                                  setPlanModalOpen(true);
                                }}
                                className="h-8 rounded-lg text-xs text-blue-600 hover:bg-blue-50"
                                title="Change Plan"
                              >
                                <CreditCard className="size-3.5" /> Plan
                              </Button>

                              {org.status === "suspended" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStatusChange(org.id, "active")}
                                  className="h-8 rounded-lg text-xs text-emerald-600 hover:bg-emerald-50"
                                >
                                  Activate
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStatusChange(org.id, "suspended")}
                                  className="h-8 rounded-lg text-xs text-amber-600 hover:bg-amber-50"
                                >
                                  Suspend
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteOrgTarget(org);
                                  setDeleteModalOpen(true);
                                }}
                                className="h-8 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                                title="Soft Delete"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Showing Page {currentPage} of {totalPages} ({organizations.length} total)
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      className="h-7 w-7 p-0 rounded-lg"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      className="h-7 w-7 p-0 rounded-lg"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STORES TAB */}
          {activeTab === "stores" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Stores & Outlets ({storesList.length})</h2>
              <p className="text-xs text-muted-foreground">Manage POS outlets across all registered tenant accounts</p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border font-semibold uppercase text-[10px] text-muted-foreground">
                    <tr>
                      <th className="p-3.5">Store Name</th>
                      <th className="p-3.5">Store Code</th>
                      <th className="p-3.5">Organization</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {storesList.map((st) => (
                      <tr key={st.id} className="hover:bg-muted/30">
                        <td className="p-3.5 font-semibold text-foreground">{st.name}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">{st.code || "STR-MAIN"}</td>
                        <td className="p-3.5 text-foreground font-medium">{st.organizationName}</td>
                        <td className="p-3.5"><Badge variant="outline">{st.status || "active"}</Badge></td>
                        <td className="p-3.5"><Button size="sm" variant="ghost" className="h-7 text-xs">Edit Store</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Tenant Users ({usersList.length})</h2>
              <p className="text-xs text-muted-foreground">Platform user accounts across all tenant organizations</p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border font-semibold uppercase text-[10px] text-muted-foreground">
                    <tr>
                      <th className="p-3.5">User</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Organization</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">{u.name}</div>
                          <div className="text-[10px] text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="p-3.5"><Badge variant="secondary" className="capitalize">{u.role}</Badge></td>
                        <td className="p-3.5 text-foreground font-medium">{u.organizationName}</td>
                        <td className="p-3.5">{getStatusBadge(u.status)}</td>
                        <td className="p-3.5"><Button size="sm" variant="ghost" className="h-7 text-xs text-purple-600">Reset Pass</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AUDIT LOGS TAB */}
          {activeTab === "audit-logs" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Platform Audit Logs</h2>
              <p className="text-xs text-muted-foreground">System action log with IP address tracking</p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border font-semibold uppercase text-[10px] text-muted-foreground">
                    <tr>
                      <th className="p-3.5">Action</th>
                      <th className="p-3.5">Performed By</th>
                      <th className="p-3.5">Details</th>
                      <th className="p-3.5">IP Address</th>
                      <th className="p-3.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="p-3.5 font-mono text-primary font-semibold">{log.action}</td>
                        <td className="p-3.5 text-foreground">{log.performedBy}</td>
                        <td className="p-3.5 text-muted-foreground">{log.details}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">{log.ip}</td>
                        <td className="p-3.5 text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SYSTEM HEALTH TAB */}
          {activeTab === "system-health" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">System & Telemetry Status</h2>
              <p className="text-xs text-muted-foreground">Live infrastructure component health</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="font-semibold text-xs flex items-center justify-between text-emerald-600">
                    <span className="flex items-center gap-2"><Database className="size-4" /> PostgreSQL Database (Railway)</span>
                    <CheckCircle className="size-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">Provider: Railway Managed PostgreSQL (Latency: 4ms)</p>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="font-semibold text-xs flex items-center justify-between text-blue-600">
                    <span className="flex items-center gap-2"><HardDrive className="size-4" /> Cloudinary Media CDN</span>
                    <CheckCircle className="size-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">Media CDN Storage & Upload API: CONNECTED</p>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="space-y-4 max-w-xl">
              <h2 className="text-lg font-bold text-foreground">Platform Administration Settings</h2>
              <p className="text-xs text-muted-foreground">Global SaaS configuration parameters</p>
              <div className="p-6 rounded-2xl bg-card border border-border space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Platform Name</Label>
                  <Input value="Apka Bill SaaS" readOnly className="rounded-xl h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Support Email</Label>
                  <Input value="support@apkabill.com" readOnly className="rounded-xl h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Maintenance Mode</Label>
                  <Badge variant="outline" className="text-emerald-600">DISABLED (System Operational)</Badge>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PASSWORD MANAGEMENT MODAL */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Key className="size-4 text-purple-600" /> Password Management
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage organization owner credentials for: <span className="font-bold text-foreground">{passOrg?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-accent/40 border border-border space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">Owner Admin Email</div>
              <div className="font-bold text-foreground">{passOrg?.ownerEmail}</div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Generated Strong Password</Label>
              <div className="flex items-center gap-2">
                <Input value={generatedPassword} onChange={(e) => setGeneratedPassword(e.target.value)} className="font-mono rounded-xl h-9 text-xs" />
                <Button size="sm" variant="outline" onClick={handleCopyPassword} className="rounded-xl h-9 text-xs gap-1">
                  {copiedPass ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>

            <Button size="sm" variant="secondary" onClick={handleGenerateStrongPassword} className="w-full rounded-xl text-xs gap-1">
              <Sparkles className="size-3.5 text-amber-500" /> Regenerate Strong Password
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPasswordModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={() => setConfirmPassModal(true)} className="rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700">
              Apply Password Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM PASSWORD CHANGE MODAL */}
      <Dialog open={confirmPassModal} onOpenChange={setConfirmPassModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-purple-600">
              <AlertTriangle className="size-4" /> Confirm Password Update
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to update the password for <span className="font-bold text-foreground">{passOrg?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmPassModal(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button size="sm" disabled={resettingPass} onClick={handleConfirmResetPassword} className="rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700">
              {resettingPass ? "Updating…" : "Confirm & Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CHANGE SUBSCRIPTION PLAN MODAL */}
      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="size-4 text-blue-600" /> Change Subscription Plan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update billing tier for: <span className="font-bold text-foreground">{planOrg?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <Label className="text-xs font-semibold">Select Subscription Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger className="rounded-xl h-9 text-xs">
                <SelectValue placeholder="Select Plan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="Trial">Free Trial</SelectItem>
                <SelectItem value="Basic">Basic Plan</SelectItem>
                <SelectItem value="Pro">Pro Plan</SelectItem>
                <SelectItem value="Enterprise">Enterprise Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPlanModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button size="sm" disabled={updatingPlan} onClick={handleSavePlanChange} className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700">
              {updatingPlan ? "Updating…" : "Save Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SOFT DELETE CONFIRMATION MODAL */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
              <Trash2 className="size-4" /> Confirm Soft Delete
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will set organization status to <span className="font-mono text-destructive font-bold">DISABLED</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleSoftDeleteOrg} className="rounded-xl text-xs font-bold">
              Soft Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ORGANIZATION DETAILS MODAL */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="size-4 text-primary" /> Organization 360° Overview
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete multi-tenant breakdown for selected business account
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" /> Loading Details…
            </div>
          ) : selectedOrgDetails ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-accent/40 border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Business Name</div>
                  <div className="font-bold text-foreground text-sm">{selectedOrgDetails.organization.name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Slug & ID</div>
                  <div className="font-mono text-muted-foreground">#{selectedOrgDetails.organization.id} · {selectedOrgDetails.organization.slug}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Status</div>
                  <div className="mt-0.5">{getStatusBadge(selectedOrgDetails.organization.status)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Plan</div>
                  <div className="mt-0.5">{getPlanBadge(selectedOrgDetails.organization.billing_plan)}</div>
                </div>
              </div>

              {selectedOrgDetails.owner && (
                <div className="p-4 rounded-xl border border-border space-y-1 bg-card">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <User className="size-3.5 text-primary" /> Account Owner
                  </div>
                  <div className="text-muted-foreground font-medium">{selectedOrgDetails.owner.name} ({selectedOrgDetails.owner.email})</div>
                  <div className="text-muted-foreground">Phone: {selectedOrgDetails.owner.phone || "N/A"}</div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailsModalOpen(false)} className="rounded-xl text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
