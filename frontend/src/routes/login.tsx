import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Lock, Mail, AlertCircle, Building2, HelpCircle } from "lucide-react";
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
        if (data.user.role) {
          const formattedRole = data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1).toLowerCase();
          setRole(formattedRole as any);
        }
        if (data.user.store_id) {
          localStorage.setItem("currentStoreId", String(data.user.store_id));
          setActiveStoreId(Number(data.user.store_id));
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
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl h-10 text-xs"
                autoComplete="current-password"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl h-10 text-xs font-bold gap-2 shadow-sm"
            >
              <LogIn className="size-4" /> {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="pt-2 border-t border-border/40 text-center">
            <button
              type="button"
              onClick={() => toast.info("Please contact your Apka Bill Organization Owner or System Admin to manage account access.")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
            >
              <HelpCircle className="size-3.5" /> Contact Admin
            </button>
          </div>
        </div>

        {/* FOOTER DISCLOSURE */}
        <div className="text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Apka Bill Retail Platform. All rights reserved.
        </div>
      </div>
    </div>
  );
}
