import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, install } = usePWA();
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    // Read dismissal state from localStorage
    const bannerDismissed = localStorage.getItem("orion-pwa-banner-dismissed") === "true";
    setDismissed(bannerDismissed);
  }, []);

  if (!isInstallable || isInstalled || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      console.log("PWA Installed successfully.");
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("orion-pwa-banner-dismissed", "true");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 flex flex-col gap-3 rounded-2xl border border-border bg-elevated/95 p-4 shadow-xl backdrop-blur-md transition-all md:bottom-6 md:right-6 md:left-auto md:w-96">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-black">
            O
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-tight">Install Orion App</h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Add Orion POS to your home screen for quick launch and offline operation.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1 text-ink-soft hover:bg-muted hover:text-foreground"
          aria-label="Dismiss banner"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleInstall} size="sm" className="w-full gap-2 rounded-xl">
          <Download className="size-3.5" />
          Install
        </Button>
      </div>
    </div>
  );
}
