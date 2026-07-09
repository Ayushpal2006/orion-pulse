import { useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp, type Theme } from "@/lib/store";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "orion-pos-theme";

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

export function useThemeInit() {
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);

  // Load persisted theme once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && saved !== theme) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme(theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply + persist on theme change
  useEffect(() => {
    if (typeof window === "undefined") return;
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
}

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  if (variant === "full") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {(["light", "dark", "system"] as const).map((t) => {
          const I = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
          const active = theme === t;
          return (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium capitalize transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted/60",
              )}
            >
              <I className="size-4" /> {t}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Toggle theme">
          <Icon className="size-4 transition-transform" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={() => setTheme("light")}>
          <Sun className="mr-2 size-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}>
          <Moon className="mr-2 size-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}>
          <Monitor className="mr-2 size-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
