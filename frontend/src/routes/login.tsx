import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Lock, Mail, AlertCircle, Building2, HelpCircle, Eye, EyeOff } from "lucide-react";
import { loginApi } from "@/lib/api";
import { useApp } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login · Apka Bill" },
      { name: "description", content: "Sign in to Apka Bill retail management platform." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setRole = useApp((s) => s.setRole);
  const setActiveStoreId = useApp((s) => s.setActiveStoreId);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const data = await loginApi(email, password);

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      if (data.user) {
        const userRoleLower = (data.user.role || "").toLowerCase();
        if (data.user.role) {
          const formattedRole = data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1).toLowerCase();
          setRole(formattedRole as any);
        }
        if (data.user.organization_id) {
          localStorage.setItem("currentOrgId", String(data.user.organization_id));
        } else {
          localStorage.removeItem("currentOrgId");
        }
        if (data.user.store_id) {
          localStorage.setItem("currentStoreId", String(data.user.store_id));
          setActiveStoreId(Number(data.user.store_id));
        } else {
          localStorage.removeItem("currentStoreId");
        }
        if (userRoleLower === "superadmin" || userRoleLower === "super_admin") {
          toast.success("Welcome back, System Super Admin!");
          navigate({ to: "/admin" as any });
          return;
        }
      }

      toast.success(`Welcome back, ${data.user?.name || "User"}!`);
      navigate({ to: "/" });
    } catch (err: any) {
      const msg = err.message || "Invalid credentials. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* BRANDING HEADER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-primary text-primary-foreground font-bold shadow-md mb-1">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Apka Bill</h1>
          <p className="text-xs text-muted-foreground">Sign in to your organization account to continue</p>
        </div>

        {/* LOGIN CARD */}
        <div className="card-soft p-6 space-y-5 border border-border shadow-sm rounded-2xl bg-card">
          {errorMessage && (
            <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" /> Email Address
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="rounded-xl h-10 text-xs"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" /> Password
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl h-10 text-xs pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl h-12 text-sm font-bold gap-2 shadow-md hover:shadow-lg touch-btn active:scale-[0.99] transition-all"
            >
              <LogIn className="size-4" /> {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          {/* Quick Demo Login Credentials Chips */}
          <div className="pt-3 border-t border-border/60 space-y-2">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Demo Quick Sign-in</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setEmail("admin@demo.com"); setPassword("password123"); }}
                className="px-2.5 py-2 rounded-xl border border-border bg-muted/30 hover:bg-muted text-[11px] font-semibold text-foreground text-left transition-colors flex items-center justify-between"
              >
                <span>Org Admin</span>
                <span className="text-[9px] font-mono text-muted-foreground">admin@</span>
              </button>
              <button
                type="button"
                onClick={() => { setEmail("super@demo.com"); setPassword("admin123"); }}
                className="px-2.5 py-2 rounded-xl border border-border bg-muted/30 hover:bg-muted text-[11px] font-semibold text-foreground text-left transition-colors flex items-center justify-between"
              >
                <span>Super Admin</span>
                <span className="text-[9px] font-mono text-muted-foreground">super@</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40 text-center">
            <button
              type="button"
              onClick={() => toast.info("Please contact your Apka Bill Organization Owner or System Admin to manage account access.")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 font-medium"
            >
              <HelpCircle className="size-3.5" /> Need help logging in? Contact Admin
            </button>
          </div>
        </div>

        {/* FOOTER DISCLOSURE */}
        <div className="text-center text-[11px] text-muted-foreground font-medium">
          © {new Date().getFullYear()} Apka Bill Retail Platform. All rights reserved.
        </div>
      </div>
    </div>
  );
}
