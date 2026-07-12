import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useApp, type Role } from "@/lib/store";

export function RoleGate({
  allow,
  children,
  fallback,
}: {
  allow: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const role = useApp((s) => s.role);
  if (allow.includes(role)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" />
      </div>
      <div className="mt-3 text-sm font-semibold">Access denied</div>
      <div className="mt-1 max-w-xs text-xs text-muted-foreground">
        Your role ({role}) doesn't have permission to view this. Ask an Admin to switch roles.
      </div>
    </div>
  );
}

export function useCan(allow: Role[]) {
  const role = useApp((s) => s.role);
  return allow.includes(role);
}
